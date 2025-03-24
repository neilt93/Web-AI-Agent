import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { Navigator } from './browser/navigator';
import { askGPTVisionWhatToDo } from './llm/visionPlanner.ts';
import dotenv from 'dotenv';

dotenv.config();

const SCREENSHOT_DIR = 'screenshots';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

async function performActionWithRetry(
  action: () => Promise<void>,
  actionName: string,
  maxRetries: number = MAX_RETRIES
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      return true;
    } catch (error) {
      console.warn(`[⚠️] Attempt ${attempt}/${maxRetries} failed for ${actionName}:`, error);
      if (attempt < maxRetries) {
        console.log(`[⏳] Waiting ${RETRY_DELAY}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  return false;
}

export const launchBot = async () => {
    const browser = await chromium.launch({ headless: false });
    const userDataDir = path.join(process.cwd(), 'playwright-data');
    
    // Create persistent context with user data directory
    const context = await browser.newContext({
      storageState: userDataDir,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      colorScheme: 'light'
    });

    const page = await context.newPage();
    const bot = new Navigator();
    await bot.setPage(page);
  
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR);
    }
  
    await bot.navigateTo('https://www.notion.so/');
  
    let step = 1;
    const actionHistory: { action: string; selector?: string; tabIndex?: number; timestamp: number }[] = [];
  
    while (step < 20) {
      const screenshotPath = path.join(SCREENSHOT_DIR, `step-${step}.png`);
      await bot.captureViewportScreenshot(screenshotPath);

      // Collect information about all open pages
      const pages = await Promise.all(
        context.pages().map(async (p, index) => ({
          index,
          url: p.url(),
          title: await p.title()
        }))
      );
  
      const gptResponse = await askGPTVisionWhatToDo(screenshotPath, pages, actionHistory);
  
      console.log(`\n[🧠] GPT Suggestion (Step ${step}):\n`, gptResponse);
      console.log('\n[📑] Open Pages:', pages.map(p => `\n  Tab ${p.index}: ${p.title}`).join(''));
  
      // Get the target page for the action
      const targetTabIndex = gptResponse.tabIndex ?? 0;
      const targetPage = context.pages()[targetTabIndex];
      
      if (!targetPage) {
        console.warn(`[⚠️] Target tab ${targetTabIndex} not found. Skipping action...`);
        continue;
      }

      // Switch to target page if needed
      if (targetTabIndex !== pages.findIndex(p => p.url === page.url())) {
        await targetPage.bringToFront();
        await bot.setPage(targetPage);
        console.log(`[🔄] Switched to tab ${targetTabIndex} for action`);
      }
  
      let actionSuccess = false;
  
      if (gptResponse.action === 'click' && gptResponse.selector) {
        console.log(`[🖱] Clicking "${gptResponse.selector}" on tab ${targetTabIndex}`);
        actionSuccess = await performActionWithRetry(
          () => bot.click(gptResponse.selector!),
          `click ${gptResponse.selector}`
        );
      } else if (gptResponse.action === 'type' && gptResponse.selector && gptResponse.text) {
        console.log(`[⌨️] Typing into "${gptResponse.selector}" on tab ${targetTabIndex}`);
        actionSuccess = await performActionWithRetry(
          () => bot.type(gptResponse.selector!, gptResponse.text!),
          `type into ${gptResponse.selector}`
        );
      } else if (gptResponse.action === 'scroll') {
        console.log(`[🖱] Scrolling on tab ${targetTabIndex}`);
        actionSuccess = await performActionWithRetry(
          () => page.mouse.wheel(0, 300),
          'scroll'
        );
      } else if (gptResponse.action === 'switchTab' && typeof gptResponse.tabIndex === 'number') {
        const pages = context.pages();
        if (pages[gptResponse.tabIndex]) {
          actionSuccess = await performActionWithRetry(
            async () => {
              await pages[gptResponse.tabIndex!].bringToFront();
              await bot.setPage(pages[gptResponse.tabIndex!]);
            },
            `switch to tab ${gptResponse.tabIndex}`
          );
        }
      } else if (gptResponse.action === 'done') {
        console.log('[✅] Bot task complete!');
        break;
      } else {
        console.warn('[⚠️] Unknown action or missing parameters. Skipping...');
      }

      if (!actionSuccess) {
        console.error(`[❌] Failed to perform action after ${MAX_RETRIES} attempts. Stopping...`);
        break;
      }

      // Record the action in history
      actionHistory.push({
        action: gptResponse.action,
        selector: gptResponse.selector,
        tabIndex: gptResponse.tabIndex,
        timestamp: Date.now()
      });
  
      await page.waitForTimeout(1000); // Wait for potential child pages
      step++;
      console.log(`[🔍] Step ${step} complete`);
    }
  
    // await browser.close();
  };