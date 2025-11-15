import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Prompts are in the project root, not in backend/
const promptsDir = join(__dirname, '../../../prompts');

const cache = new Map<string, string>();

export function loadPrompt(filename: string): string {
  if (cache.has(filename)) {
    return cache.get(filename)!;
  }

  const path = join(promptsDir, filename);
  const content = readFileSync(path, 'utf8').toString();
  cache.set(filename, content);
  return content;
}
