import type { Timestamp } from '@google-cloud/firestore';

import { getFirestore } from '@carelink/memory-storage';

import { config } from '../config.js';

const db = getFirestore({
  projectId: config.firestore.projectId,
  emulatorHost: config.firestore.emulatorHost,
});

export async function runDailyDigest(userId: string, date?: string): Promise<{
  userId: string;
  date: string;
  highlights: Array<{ role: string; text: string; createdAt: string }>;
}> {
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const userRef = db.collection('users').doc(userId);
  const conversations = await userRef.collection('conversations').get();
  const highlights: Array<{ role: string; text: string; createdAt: string }> = [];

  await Promise.all(
    conversations.docs.map(async (conversation) => {
      const turns = await conversation.ref.collection('turns').orderBy('createdAt', 'desc').limit(50).get();
      for (const turn of turns.docs) {
        const data = turn.data();
        const createdAt = normalizeTimestamp(data.createdAt as Timestamp | string | undefined);
        const createdAtDate = new Date(createdAt);
        if (createdAtDate >= dayStart && createdAtDate < dayEnd) {
          highlights.push({
            role: data.role as string,
            text: data.text as string,
            createdAt,
          });
        }
      }
    }),
  );

  highlights.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    userId,
    date: dateStr,
    highlights: highlights.slice(-10),
  };
}

function normalizeTimestamp(value?: Timestamp | string): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
}

