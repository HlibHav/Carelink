import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4202),
  eventBusUrl: process.env.EVENT_BUS_URL?.replace(/\/$/, '') ?? 'http://localhost:4300',
  memoryManagerUrl:
    process.env.MEMORY_MANAGER_URL?.replace(/\/$/, '') ?? 'http://localhost:4103',
  schedulingUrl:
    process.env.SCHEDULING_SERVICE_URL?.replace(/\/$/, '') ?? 'http://localhost:4205',
  notificationChannel: process.env.SAFETY_NOTIFICATION_CHANNEL ?? 'caregiver',
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? undefined,
    organization: process.env.OPENAI_ORG ?? undefined,
    project: process.env.OPENAI_PROJECT ?? undefined,
    model: process.env.OPENAI_SAFETY_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  },
};
