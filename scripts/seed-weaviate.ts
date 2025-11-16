import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import dotenv from 'dotenv';

import { getWeaviateClient, ensureCollection, insertMemory } from '@carelink/weaviate-client';
import type { MemoryVector } from '@carelink/weaviate-client';

const envCandidates = [
  resolve(process.cwd(), '.env/.env'),
  resolve(process.cwd(), '.env'),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function seed(): Promise<void> {
  const client = await getWeaviateClient();
  await ensureCollection(client);

  const now = new Date().toISOString();
  const memories: MemoryVector[] = [
    {
      id: randomUUID(),
      userId: 'demo-user',
      category: 'facts',
      text: 'My name is Anna and I live in Kyiv.',
      importance: 'medium',
      factType: 'family',
      metadata: { source: 'seed-script', note: 'test fact' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      userId: 'demo-user',
      category: 'goals',
      text: 'I want to walk 6000 steps every day.',
      importance: 'high',
      goalStatus: 'active',
      metadata: { source: 'seed-script', note: 'test goal' },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      userId: 'demo-user',
      category: 'gratitude',
      text: 'I am grateful for my morning walk with Sara.',
      importance: 'medium',
      metadata: { source: 'seed-script', note: 'test gratitude' },
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const memory of memories) {
    const id = await insertMemory(client, memory);
    console.log(`Inserted memory ${id} (${memory.category})`);
  }

  console.log('Seeding complete.');
}

seed().catch((error) => {
  console.error('Failed to seed Weaviate:', error);
  process.exit(1);
});
