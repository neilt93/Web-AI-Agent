// ./browser/sessionManager.ts

import { Browser, BrowserContext } from '@playwright/test';
import fs from 'fs';

/**
 * Path where browser session data is stored
 * Contains cookies, localStorage, and other browser state
 */
const SESSION_PATH = 'sessions/notion-session.json';

/**
 * Loads a saved browser session or creates a new one if none exists
 * 
 * @param browser - Playwright Browser instance
 * @returns Promise<BrowserContext> A new browser context with either:
 *          - Previously saved session state (if exists)
 *          - Fresh session state (if no saved session)
 * 
 * @example
 * const context = await loadSession(browser);
 * // Returns a context with either saved or fresh session state
 */
export async function loadSession(browser: Browser): Promise<BrowserContext> {
  if (fs.existsSync(SESSION_PATH)) {
    console.log('[📂] Loading saved session...');
    return await browser.newContext({ storageState: SESSION_PATH });
  }

  console.log('[🆕] No session found — starting fresh.');
  return await browser.newContext();
}

/**
 * Saves the current browser session state to disk
 * This includes cookies, localStorage, and other browser state
 * 
 * @param context - Playwright BrowserContext instance to save
 * @returns Promise<void>
 * 
 * @example
 * await saveSession(context);
 * // Saves current session state to SESSION_PATH
 */
export async function saveSession(context: BrowserContext) {
  await context.storageState({ path: SESSION_PATH });
  console.log('[💾] Session saved.');
}
