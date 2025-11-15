import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (.env/.env)
dotenv.config({ path: resolve(__dirname, '../../../.env/.env') });

export const config = {
  port: Number(process.env.PORT ?? 4103),
  firestore: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
};
