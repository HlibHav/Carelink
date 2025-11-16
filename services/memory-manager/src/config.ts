import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (.env/.env or .env)
const envPath1 = resolve(__dirname, '../../../.env/.env');
const envPath2 = resolve(__dirname, '../../../.env');
const envPath = existsSync(envPath1) ? envPath1 : envPath2;
dotenv.config({ path: envPath });

export const config = {
  port: Number(process.env.PORT ?? 4103),
  weaviate: {
    url: process.env.WEAVIATE_URL,
    host: process.env.WEAVIATE_HOST || 'localhost',
    port: Number(process.env.WEAVIATE_PORT || 8082),
    scheme: (process.env.WEAVIATE_SCHEME === 'https' ? 'https' : 'http') as 'http' | 'https',
    apiKey: process.env.WEAVIATE_API_KEY,
  },
};
