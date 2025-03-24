// ./notionBot.ts

import { chromium } from '@playwright/test';
import { Navigator } from './browser/navigator';
import { loadSession, saveSession } from './browser/sessionManager';
import { getLoginPlanFromDOM } from './llm/domLoginPlanner';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const EMAIL = process.env.NOTION_EMAIL;
const PASSWORD = process.env.NOTION_PASSWORD;
const SITE = 'Notion';

if (!EMAIL || !PASSWORD) {
  throw new Error('NOTION_EMAIL and NOTION_PASSWORD must be set in .env file');
}

export const launchBot = async () => {
  const browser = await chromium.launch({ headless: false });

  // Load existing session or start fresh
  const context = await loadSession(browser);
  const page = await context.newPage();
  const bot = new Navigator();
  await bot.setPage(page);  // Set the existing page instead of launching new browser

  // Navigate to Notion
  await bot.navigateTo('https://www.notion.so/');

  // Check if already logged in by looking for dashboard elements
  try {
    await bot.waitForSelector('text=Quick Find', { timeout: 5000 });
    console.log('[✅] Already logged in via session.');
    await browser.close();
    return;
  } catch (e) {
    console.log('[🔑] Not logged in, proceeding with login...');
  }

  // Get the page DOM and send it to the LLM
  const dom = await bot.getPageContent();
  const selectors = await getLoginPlanFromDOM(dom, SITE);

  console.log('[🤖] Login selectors from GPT:', selectors);

  // Login using GPT's suggested selectors
  await bot.click(selectors.email);
  await bot.type(selectors.email, EMAIL);
  await bot.click(selectors.password);
  await bot.type(selectors.password, PASSWORD);
  await bot.click(selectors.submit);

  // Wait for dashboard or workspace indicator
  await bot.waitForSelector('text=Quick Find', { timeout: 15000 });
  console.log('[🏠] Logged in and on dashboard!');

  // Save session
  await saveSession(context);

  await browser.close();
};
