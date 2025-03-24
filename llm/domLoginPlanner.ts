// ./llm/domLoginPlanner.ts

import OpenAI from 'openai';

/**
 * OpenAI client instance configured with API key from environment variables
 */
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extracts only relevant HTML for login analysis (inputs, buttons, forms).
 */
export async function getLoginPlanFromDOM(html: string, site: string) {
    // Sanitize large HTML inputs
    const trimmedHTML = trimLoginDOM(html);

    const prompt = `
You are a web automation expert helping an AI agent identify login form elements from HTML.

Your task is to extract ONLY the CSS selectors for:
1. The email input
2. The password input
3. The login/submit button

Respond in **raw JSON only**. Do NOT explain, do NOT return markdown, do NOT include HTML or comments.

Use this format:
{
  "email": "<css-selector>",
  "password": "<css-selector>",
  "submit": "<css-selector>"
}

Below is the partial HTML:

${trimmedHTML}
`;

    const res = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0
    });

    let raw = res.choices[0].message?.content || '{}';

    // Remove markdown wrappers like ```json or ```html
    raw = raw.trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');

    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error('[❌] Failed to parse GPT response as JSON:', raw);
        throw err;
    }
    

}

/**
 * Helper function to trim the full HTML and keep only login-relevant tags.
 */
function trimLoginDOM(fullHTML: string): string {
    // Extract only inputs, buttons, forms (up to a safe character limit)
    const inputMatches = (fullHTML.match(/<input[^>]*>/g) || []).map(String);
    const buttonMatches = (fullHTML.match(/<button[^>]*>.*?<\/button>/g) || []).map(String);
    const formMatches = (fullHTML.match(/<form[^>]*>.*?<\/form>/gs) || []).map(String);

    const partialHTML = inputMatches
        .concat(buttonMatches)
        .concat(formMatches)
        .join('\n')
        .slice(0, 6000); // limit to avoid token overflow

    return partialHTML;
}
