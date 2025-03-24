// ./llm/visionPlanner.ts

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

type GPTAction = {
  action: 'click' | 'type' | 'done' | 'scroll' | 'switchTab';
  selector?: string;
  text?: string;
  tabIndex?: number;
};

type PageInfo = {
  index: number;
  url: string;
  title: string;
};

type ActionHistory = {
  action: string;
  selector?: string;
  tabIndex?: number;
  timestamp: number;
};

export async function askGPTVisionWhatToDo(
  imagePath: string, 
  pages: PageInfo[],
  actionHistory: ActionHistory[] = []
): Promise<GPTAction> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const pagesInfo = pages.map((p, i) => `Tab ${i}: ${p.title} (${p.url})`).join('\n');
  
  // Format recent actions for context
  const recentActions = actionHistory
    .slice(-3) // Last 3 actions
    .map(a => `- ${a.action}${a.selector ? ` "${a.selector}"` : ''}${a.tabIndex !== undefined ? ` on tab ${a.tabIndex}` : ''}`)
    .join('\n');

  const prompt = `
You're a web automation agent. Your job is to look at the screenshot and decide what action to take next.

Currently open pages:
${pagesInfo}

Recent actions:
${recentActions}

Important: If you see a popup or secondary window (especially after login), prioritize it over the main window. Popups often contain critical actions like:
- Login forms
- Permission requests
- OAuth flows (like Google Sign In)
- Security verifications

For OAuth flows:
1. When you see a Google Sign In popup, switch to that tab immediately
2. Never click "Continue with Google" on the main page if a Google Sign In popup is open
3. Look for the popup tab in the list of open pages and use its tabIndex
4. For Google Sign In, look for the email input field and type the email address
5. After typing email, look for the "Next" button (not "Continue")

Button Selection Rules:
1. Use exact text matches for buttons
2. For Google Sign In, use "Next" instead of "Continue"
3. Avoid clicking disabled buttons (they appear grayed out)
4. If a button has multiple states, use the most specific selector (e.g., "button:has-text('Continue with Google')" vs "text=Continue")

Respond with one of these actions in JSON format:
- Click a button or link: { "action": "click", "selector": "text=Button Name", "tabIndex": 0 } (use exact text seen in screenshot)
- Type into a field: { "action": "type", "selector": "input[type='email']", "text": "you@example.com", "tabIndex": 0 }
- Switch to another tab: { "action": "switchTab", "tabIndex": 1 } (0 is first tab, 1 is second tab, etc.)
- The bot can also scroll down. To scroll, respond with: { "action": "scroll", "tabIndex": 0 }
- If you're finished: { "action": "done" }

For selectors, you can use:
- Text content: "text=Button Name"
- Input fields: "input[type='email']"
- Buttons: "button:has-text('Click me')"
- Links: "a:has-text('Link text')"
- Any element: "[aria-label='Button label']"

For login fields, use these values:
- Email: ${process.env.NOTION_EMAIL}
- Password: ${process.env.NOTION_PASSWORD}

Only return JSON. Do not explain anything.
`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
            }
          }
        ]
      }
    ],
    max_tokens: 500
  });

  let raw = res.choices[0].message?.content?.trim() || '{}';

  // Strip markdown formatting if GPT added any
  raw = raw.replace(/^```(json)?\n?/i, '').replace(/```$/, '');

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[❌] Failed to parse GPT response:', raw);
    return { action: 'done' };
  }
}
