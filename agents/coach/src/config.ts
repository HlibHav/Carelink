import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envFromNestedDir = resolve(__dirname, '../../../.env/.env');
const envFromRoot = resolve(__dirname, '../../../.env');
const envPath = existsSync(envFromNestedDir)
  ? envFromNestedDir
  : existsSync(envFromRoot)
    ? envFromRoot
    : undefined;

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`[Coach Config] Loaded env from ${envPath}`);
} else {
  console.warn('[Coach Config] .env path not found, falling back to default search');
  dotenv.config();
}

if (process.env.OPENAI_API_KEY) {
  console.log('[Coach Config] OPENAI_API_KEY detected');
} else {
  console.warn('[Coach Config] OPENAI_API_KEY is missing after loading env');
}

const defaultPort = 4201;
const resolvedPort = Number(process.env.COACH_AGENT_PORT ?? process.env.COACH_PORT ?? defaultPort);
console.log(`[Coach Config] Ports => COACH_AGENT_PORT=${process.env.COACH_AGENT_PORT ?? 'unset'}, PORT=${process.env.PORT ?? 'unset'}`);

export const config = {
  port: resolvedPort,
  eventBusUrl: process.env.EVENT_BUS_URL?.replace(/\/$/, '') ?? 'http://localhost:4300',
  memoryManagerUrl:
    process.env.MEMORY_MANAGER_URL?.replace(/\/$/, '') ?? 'http://localhost:4103',
  physicalEngineUrl:
    process.env.PHYSICAL_ENGINE_URL?.replace(/\/$/, '') ?? 'http://localhost:4101',
  mindBehaviorEngineUrl:
    process.env.MIND_BEHAVIOR_ENGINE_URL?.replace(/\/$/, '') ?? 'http://localhost:4102',
  schedulingServiceUrl:
    process.env.SCHEDULING_SERVICE_URL?.replace(/\/$/, '') ?? 'http://localhost:4205',
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? undefined,
    organization: process.env.OPENAI_ORG ?? undefined,
    project: process.env.OPENAI_PROJECT ?? undefined,
    model: process.env.OPENAI_COACH_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  },
};
