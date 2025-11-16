import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFromEnvDir = resolve(__dirname, '../../../.env/.env');
const envFromRoot = resolve(__dirname, '../../../.env');
const envPath = existsSync(envFromEnvDir)
  ? envFromEnvDir
  : existsSync(envFromRoot)
    ? envFromRoot
    : undefined;

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`[Dialogue Config] Loaded env from ${envPath}`);
} else {
  console.warn('[Dialogue Config] .env path not found, falling back to default search');
  dotenv.config();
}

console.log(
  `[Dialogue Config] Port envs => DIALOGUE_AGENT_PORT=${process.env.DIALOGUE_AGENT_PORT ?? 'unset'}, PORT=${process.env.PORT ?? 'unset'}`,
);

if (process.env.OPENAI_API_KEY) {
  console.log('[Dialogue Config] OPENAI_API_KEY detected');
} else {
  console.warn('[Dialogue Config] OPENAI_API_KEY is missing after loading env');
}

const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174'];
const allowedOrigins = (() => {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return defaultOrigins;
})();

const resolvedPort = Number(process.env.DIALOGUE_AGENT_PORT ?? 4200);

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: resolvedPort,
  allowedOrigins,
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    organization: process.env.OPENAI_ORG ?? undefined,
    project: process.env.OPENAI_PROJECT ?? undefined,
    baseUrl: process.env.OPENAI_BASE_URL ?? undefined,
    models: {
      chat: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      planner: process.env.OPENAI_PLANNER_MODEL ?? 'gpt-4o-mini',
      emotion: process.env.OPENAI_EMOTION_MODEL ?? 'gpt-4o-mini',
    },
  },
  services: {
    physicalEngineUrl:
      process.env.PHYSICAL_ENGINE_URL?.replace(/\/$/, '') ?? 'http://localhost:4101',
    mindBehaviorEngineUrl:
      process.env.MIND_BEHAVIOR_ENGINE_URL?.replace(/\/$/, '') ?? 'http://localhost:4102',
    memoryManagerUrl:
      process.env.MEMORY_MANAGER_URL?.replace(/\/$/, '') ?? 'http://localhost:4103',
    eventBusUrl:
      process.env.EVENT_BUS_URL?.replace(/\/$/, '') ?? 'http://localhost:4300',
  },
};
