import { Firestore } from '@google-cloud/firestore';

import { config } from './config.js';

let cachedDb: Firestore | null = null;

export function getFirestore(): Firestore {
  if (!cachedDb) {
    cachedDb = new Firestore(
      config.firestore.projectId
        ? {
            projectId: config.firestore.projectId,
          }
        : undefined,
    );

    if (config.firestore.emulatorHost) {
      cachedDb.settings({
        host: config.firestore.emulatorHost,
        ssl: false,
      });
    }
  }

  return cachedDb;
}
