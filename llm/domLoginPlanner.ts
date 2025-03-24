// ./llm/domLoginPlanner.ts

import OpenAI from 'openai';

/**
 * OpenAI client instance configured with API key from environment variables
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyzes HTML of a login page to identify CSS selectors for login form elements
 * 
 * @param html - The HTML source code of the login page
 * @param site - The name of the website (used for context in the prompt)
 * @returns Promise<{email: string, password: string, submit: string}> Object containing CSS selectors for:
 *          - email: Selector for the email input field
 *          - password: Selector for the password input field
 *          - submit: Selector for the submit/login button
 * 
 * @example
 * const selectors = await getLoginPlanFromDOM(html, 'example.com');
 * // Returns: { email: '#email', password: '#password', submit: 'button[type="submit"]' }
 */
export async function getLoginPlanFromDOM(html: string, site: string) {
  const prompt = `
The following is the HTML source of a login page for ${site}.
Identify the selector I should use to:
1. Type in the email
2. Type in the password
3. Click to submit

Respond in JSON format like:
{
  "email": "<css-selector>",
  "password": "<css-selector>",
  "submit": "<css-selector>"
}

HTML:
${html}
`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0
  });

  const json = res.choices[0].message?.content || '{}';
  return JSON.parse(json);
}
