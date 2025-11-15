import dotenv from 'dotenv';

dotenv.config();

const defaultPort = 4201;

export const config = {
  port: Number(process.env.PORT ?? defaultPort),
  eventBusUrl: process.env.EVENT_BUS_URL?.replace(/\/$/, '') ?? 'http://localhost:4300',
  memoryManagerUrl:
    process.env.MEMORY_MANAGER_URL?.replace(/\/$/, '') ?? 'http://localhost:4103',
  physicalEngineUrl:
    process.env.PHYSICAL_ENGINE_URL?.replace(/\/$/, '') ?? 'http://localhost:4101',
  mindBehaviorEngineUrl:
    process.env.MIND_BEHAVIOR_ENGINE_URL?.replace(/\/$/, '') ?? 'http://localhost:4102',
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? undefined,
    organization: process.env.OPENAI_ORG ?? undefined,
    project: process.env.OPENAI_PROJECT ?? undefined,
    model: process.env.OPENAI_COACH_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  },
};
