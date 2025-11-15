import { Firestore } from '@google-cloud/firestore';

import { config } from '../config.js';

let cachedDb: Firestore | null = null;

export function getFirestore(): Firestore {
  if (!cachedDb) {
    const projectId = config.firestore.projectId;
    cachedDb = new Firestore(
      projectId
        ? {
            projectId,
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
