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
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? '',
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
    modelId: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_flash_v2',
    baseUrl: process.env.ELEVENLABS_BASE_URL?.replace(/\/$/, '') ?? 'https://api.elevenlabs.io/v1',
  },
};
