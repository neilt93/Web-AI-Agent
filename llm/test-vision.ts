import { askGPTVisionWhatToDo } from './visionPlanner.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testVisionPlanner() {
  try {
    // Test with a sample screenshot
    const imagePath = path.join(__dirname, '../test-results/screenshot.png');
    const result = await askGPTVisionWhatToDo(imagePath);
    console.log('Vision Planner Result:', result);
  } catch (error) {
    console.error('Error testing Vision Planner:', error);
  }
}

testVisionPlanner(); 