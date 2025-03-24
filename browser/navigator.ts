import { chromium, Browser, Page } from '@playwright/test';

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
    await this.page.waitForSelector(selector, { state: 'visible' });
    await this.page.click(selector);
    console.log(`[👆] Clicked on: ${selector}`);
  }

  async type(selector: string, text: string) {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.fill(selector, text);
    console.log(`Typed into: ${selector} — "${text}"`);
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
  
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('[x] Browser closed');
    }
  }
}
