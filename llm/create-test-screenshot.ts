import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTestScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to a simple webpage for testing
  await page.goto('https://example.com');
  
  // Take a screenshot
  const screenshotPath = path.join(__dirname, '../test-results/screenshot.png');
  await page.screenshot({ path: screenshotPath });
  
  await browser.close();
  console.log('Test screenshot created at:', screenshotPath);
}

createTestScreenshot(); 