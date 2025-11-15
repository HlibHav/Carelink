import dotenv from 'dotenv';

dotenv.config();

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

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4200),
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
