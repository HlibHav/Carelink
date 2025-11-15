import { Firestore } from '@google-cloud/firestore';

export interface FirestoreConfig {
  projectId?: string;
  emulatorHost?: string;
}

let cachedDb: Firestore | null = null;

export function getFirestore(config?: FirestoreConfig): Firestore {
  if (!cachedDb) {
    cachedDb = new Firestore(
      config?.projectId
        ? {
            projectId: config.projectId,
          }
        : undefined,
    );

    if (config?.emulatorHost) {
      cachedDb.settings({
        host: config.emulatorHost,
        ssl: false,
      });
    }
  }

  return cachedDb;
}

export function resetFirestoreCache(): void {
  cachedDb = null;
}

