import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV ?? 'development';

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
  env,
  port: Number(process.env.PORT ?? 8080),
  allowedOrigins,
  phoenixEndpoint: process.env.PHOENIX_ENDPOINT ?? '',
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    organization: process.env.OPENAI_ORG ?? undefined,
    project: process.env.OPENAI_PROJECT ?? undefined,
    baseUrl: process.env.OPENAI_BASE_URL ?? undefined,
    models: {
      chat: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      planner: process.env.OPENAI_PLANNER_MODEL ?? 'gpt-4o-mini',
      emotion: process.env.OPENAI_EMOTION_MODEL ?? 'gpt-4o-mini',
      transcription: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe',
      embedding: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    },
  },
  firestore: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  },
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? '',
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
    modelId: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_flash_v2',
    baseUrl: process.env.ELEVENLABS_BASE_URL?.replace(/\/$/, '') ?? 'https://api.elevenlabs.io/v1',
    agentId:
      process.env.ELEVENLABS_AGENT_ID ??
      process.env.VITE_ELEVENLABS_AGENT_ID ??
      '',
    debug: (process.env.ELEVENLABS_DEBUG ?? '').toLowerCase() === 'true',
  },
};
