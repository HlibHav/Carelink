import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4103),
  firestore: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  },
};
