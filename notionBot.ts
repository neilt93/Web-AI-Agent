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
    const userDataDir = path.join(process.cwd(), 'playwright-data');
    const browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      colorScheme: 'light',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-for-policy'
      ],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    let page = await browser.newPage();
    
    // Add additional headers to make the browser appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

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
        browser.pages().map(async (p, index) => {
          try {
            return {
              index,
              url: p.url(),
              title: await p.title().catch(() => 'Loading...')
            };
          } catch (error) {
            return {
              index,
              url: p.url(),
              title: 'Loading...'
            };
          }
        })
      );
  
      const gptResponse = await askGPTVisionWhatToDo(screenshotPath, pages, actionHistory);
  
      console.log(`\n[🧠] GPT Suggestion (Step ${step}):\n`, gptResponse);
      console.log('\n[📑] Open Pages:', pages.map(p => `\n  Tab ${p.index}: ${p.title}`).join(''));

      // Check for Google security challenges
      const currentPage = pages.find(p => p.url.includes('accounts.google.com'));
      if (currentPage) {
        const targetPage = browser.pages()[currentPage.index];
        if (targetPage) {
          try {
            // Wait for navigation to complete
            await targetPage.waitForLoadState('networkidle');
            const pageContent = await targetPage.content().catch(() => '');
            
            // Check for initial Google sign-in popup
            if (pageContent && (
              pageContent.includes('Choose an account') ||
              pageContent.includes('Continue with Google')
            )) {
              console.log('[ℹ️] Google sign-in popup detected, continuing with automation...');
              continue;
            }
            
            // Check for actual authentication challenges
            if (pageContent && (
              pageContent.includes('This browser or app may not be secure') || 
              pageContent.includes('Couldn\'t sign you in') ||
              pageContent.includes('Verify it\'s you') ||
              pageContent.includes('Security check') ||
              pageContent.includes('QR code') ||
              pageContent.includes('passkey') ||
              pageContent.includes('2-Step Verification')
            )) {
              console.log('\n[⚠️] Authentication Challenge Detected!');
              console.log('The bot has encountered a security verification that requires human intervention.');
              console.log('Please complete the verification manually in the browser window.');
              console.log('This may include:');
              console.log('- Scanning a QR code');
              console.log('- Using a passkey');
              console.log('- Completing 2-Step Verification');
              console.log('Once you\'ve completed the verification, press Enter to continue...');
              await new Promise(resolve => process.stdin.once('data', resolve));
              console.log('Resuming automation...\n');

              // After manual authentication, wait for navigation and update state
              try {
                // Wait for any navigation to complete
                await targetPage.waitForLoadState('networkidle');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Extra wait for any redirects
                
                // Get updated list of pages
                const updatedPages = await Promise.all(
                  browser.pages().map(async (p, index) => ({
                    index,
                    url: p.url(),
                    title: await p.title().catch(() => 'Loading...')
                  }))
                );

                // Find the Notion page if we've been redirected
                const notionPage = updatedPages.find(p => p.url.includes('notion.so'));
                if (notionPage) {
                  const newPage = browser.pages()[notionPage.index];
                  console.log('[🔄] Authentication complete, updating to Notion page...');
                  await newPage.bringToFront();
                  await bot.setPage(newPage);
                  page = newPage; // Update the main page reference
                } else {
                  // If we're still on Google, update to the current Google page
                  const currentGooglePage = updatedPages.find(p => p.url.includes('accounts.google.com'));
                  if (currentGooglePage) {
                    const newPage = browser.pages()[currentGooglePage.index];
                    await newPage.bringToFront();
                    await bot.setPage(newPage);
                    page = newPage;
                  }
                }
              } catch (error) {
                console.log('[ℹ️] Error during page update after authentication:', error);
                // Try to recover by getting the current active page
                const currentPages = browser.pages();
                if (currentPages.length > 0) {
                  const activePage = currentPages[0];
                  await activePage.bringToFront();
                  await bot.setPage(activePage);
                  page = activePage;
                }
              }
            }
          } catch (error) {
            // Ignore navigation errors when checking content
            console.log('[ℹ️] Page is navigating, skipping content check...');
          }
        }
      }
  
      // Prevent infinite loops by checking action history
      const recentActions = actionHistory.slice(-3);
      if (recentActions.length >= 3 && 
          recentActions.every(a => a.action === 'click' && a.selector === gptResponse.selector)) {
        console.log('\n[⚠️] Detected potential infinite loop!');
        console.log('The bot has attempted the same action multiple times.');
        console.log('Please check the page and complete any required actions manually.');
        console.log('Press Enter when ready to continue...');
        await new Promise(resolve => process.stdin.once('data', resolve));
        console.log('Resuming automation...\n');
      }
  
      // Get the target page for the action
      const targetTabIndex = gptResponse.tabIndex ?? 0;
      const targetPage = browser.pages()[targetTabIndex];
      
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
        const pages = browser.pages();
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