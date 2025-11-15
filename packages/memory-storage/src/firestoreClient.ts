import { Firestore } from '@google-cloud/firestore';

export interface FirestoreConfig {
  projectId?: string;
  emulatorHost?: string;
  keyFilename?: string;
}

let cachedDb: Firestore | null = null;

export function getFirestore(config?: FirestoreConfig): Firestore {
  if (!cachedDb) {
    // Use emulator if specified
    if (config?.emulatorHost) {
      cachedDb = new Firestore({
        projectId: config.projectId || 'demo-project',
      });
      cachedDb.settings({
        host: config.emulatorHost,
        ssl: false,
      });
    } else {
      // Use production Firestore with credentials
      const firestoreConfig: {
        projectId?: string;
        keyFilename?: string;
      } = {};

      if (config?.projectId) {
        firestoreConfig.projectId = config.projectId;
      }

      // Use keyFilename if provided, otherwise rely on GOOGLE_APPLICATION_CREDENTIALS env var
      if (config?.keyFilename) {
        firestoreConfig.keyFilename = config.keyFilename;
      }

      cachedDb = new Firestore(firestoreConfig);
    }
  }

  return cachedDb;
}

export function resetFirestoreCache(): void {
  cachedDb = null;
}

