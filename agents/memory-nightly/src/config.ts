import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (.env/.env)
dotenv.config({ path: resolve(__dirname, '../../../.env/.env') });

export const config = {
  port: Number(process.env.PORT ?? 4104),
  memoryManagerUrl:
    process.env.MEMORY_MANAGER_URL?.replace(/\/$/, '') ?? 'http://localhost:4103',
  nightly: {
    enabled: process.env.NIGHTLY_ENABLED !== 'false',
    scheduleCron: process.env.NIGHTLY_SCHEDULE_CRON ?? '0 2 * * *', // Default: 2 AM daily
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
  },
};
