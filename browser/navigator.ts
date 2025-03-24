import { chromium, Browser, Page } from '@playwright/test';
import * as Tesseract from 'tesseract.js';
import fs from 'fs';

export class Navigator {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async setPage(page: Page) {
    this.page = page;
    console.log('[✓] Page set in Navigator');
  }

  async launch() {
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
    console.log('[✓] Browser launched');
  }

  async navigateTo(url: string) {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url);
    console.log(`[→] Navigated to: ${url}`);
  }

  async click(selector: string) {
    if (!this.page) throw new Error('Browser not launched');
    console.log(`[🔍] Waiting to click selector: ${selector}`);
    await this.page.waitForSelector(selector, { timeout: 10000, state: 'visible' });
    await this.page.click(selector);
    console.log(`[🖱] Clicked: ${selector}`);
  }
  
  async type(selector: string, text: string) {
    if (!this.page) throw new Error('Browser not launched');
    console.log(`[🔍] Waiting to type into selector: ${selector}`);
    await this.page.waitForSelector(selector, { timeout: 10000, state: 'visible' });
    await this.page.fill(selector, text);
    console.log(`[⌨️ ] Typed "${text}" into: ${selector}`);
  }

  async getPageContent(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.content();
  }

  async waitForSelector(selector: string, options?: { timeout?: number }) {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.waitForSelector(selector, options);
    console.log(`[⏳] Waited for selector: ${selector}`);
  }

  async describeInput(selector: string): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.evaluate((sel) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (!el) return 'not found';
      const label = el.closest('label')?.innerText || '';
      const placeholder = el.placeholder || '';
      const aria = el.getAttribute('aria-label') || '';
      return [label, placeholder, aria].join(' | ');
    }, selector);
  }

  async getCurrentURL(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return this.page.url();
  }

  async captureScreenshot(filename: string = 'page.png') {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`[📸] Screenshot saved to ${filename}`);
  }

  async captureViewportScreenshot(filename: string) {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.screenshot({ path: filename, fullPage: false }); // only visible area
  }
  
  
  async extractTextFromScreenshot(imagePath: string = 'page.png') {
    console.log('[🧠] Running OCR...');
    const result = await Tesseract.recognize(imagePath, 'eng');
    return result.data.text;
  }

  async wait(ms: number): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.waitForTimeout(ms);
    console.log(`[⏳] Waited for ${ms}ms`);
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('[x] Browser closed');
    }
  }
}
