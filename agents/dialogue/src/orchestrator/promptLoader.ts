import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const promptCache = new Map<string, string>();

export function loadPrompt(filename: string): string {
  if (promptCache.has(filename)) {
    return promptCache.get(filename)!;
  }

  const promptPath = join(__dirname, '../../../prompts', filename);
  const content = readFileSync(promptPath, 'utf-8');
  promptCache.set(filename, content);
  return content;
}
