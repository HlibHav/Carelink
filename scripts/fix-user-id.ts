import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import dotenv from 'dotenv';

import { getWeaviateClient, insertMemory, ensureCollection } from '@carelink/weaviate-client';
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

const DEFAULT_USER_ID =
  process.env.VITE_ELEVENLABS_USER_ID ??
  process.env.DIALOGUE_DEFAULT_USER_ID ??
  process.env.DEMO_USER_ID ??
  'demo-user';

async function fixUserIds(): Promise<void> {
  const client = await getWeaviateClient();
  await ensureCollection(client);

  const collector = await client.graphql
    .get()
    .withClassName('Memory')
    .withFields('userId text category importance factType goalStatus metadata createdAt updatedAt retrievalCount lastRetrievedAt _additional { id }')
    .withLimit(1000)
    .do();

  const items = (collector.data?.Get?.Memory ?? []) as any[];
  if (!items.length) {
    console.log('No memory objects found');
    return;
  }

  let toUpdate = items.filter((item) => item.userId !== DEFAULT_USER_ID);
  if (!toUpdate.length) {
    console.log('All memory objects already use', DEFAULT_USER_ID);
    return;
  }

  console.log(`Found ${toUpdate.length} memory objects with mismatched userId, rewriting...`);

  let updated = 0;
  for (const item of toUpdate) {
    const memory: MemoryVector = {
      id: item._additional?.id,
      userId: DEFAULT_USER_ID,
      category: item.category,
      text: item.text,
      importance: item.importance,
      factType: item.factType ?? undefined,
      goalStatus: item.goalStatus ?? undefined,
      metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata ?? undefined,
      createdAt: item.createdAt ?? new Date().toISOString(),
      updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
      retrievalCount: item.retrievalCount ?? undefined,
      lastRetrievedAt: item.lastRetrievedAt ?? undefined,
    };

    await insertMemory(client, memory);
    updated += 1;
  }

  console.log(`Rewrote ${updated} memory objects to userId=${DEFAULT_USER_ID}`);
}

fixUserIds().catch((error) => {
  console.error('Failed to fix user ids:', error);
  process.exit(1);
});
