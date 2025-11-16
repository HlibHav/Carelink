import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

import {
  getWeaviateClient,
  insertMemory,
  ensureCollection,
} from '@carelink/weaviate-client';
import type { MemoryVector, WeaviateConfig } from '@carelink/weaviate-client';

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

type Endpoint = 'source' | 'target';

function resolveConfig(endpoint: Endpoint): WeaviateConfig {
  const prefix = endpoint === 'source' ? 'SOURCE_' : 'TARGET_';
  const fallbackPrefix = endpoint === 'target' ? '' : 'SOURCE_';

  const fromEnv = (name: string): string | undefined => {
    return (
      process.env[`${prefix}${name}`] ??
      (fallbackPrefix ? process.env[`${fallbackPrefix}${name}`] : undefined) ??
      (endpoint === 'target' ? process.env[name] : undefined)
    );
  };

  return {
    url: fromEnv('WEAVIATE_URL'),
    host: fromEnv('WEAVIATE_HOST'),
    port: fromEnv('WEAVIATE_PORT')
      ? Number(fromEnv('WEAVIATE_PORT'))
      : undefined,
    scheme: (fromEnv('WEAVIATE_SCHEME') as 'http' | 'https' | undefined) ?? undefined,
    apiKey: fromEnv('WEAVIATE_API_KEY'),
  };
}

async function migrateMemories(): Promise<void> {
  const batchSize = Number(process.env.WEAVIATE_MIGRATION_BATCH_SIZE ?? 50);
  const sourceConfig = resolveConfig('source');
  const targetConfig = resolveConfig('target');

  console.log('Connecting to source Weaviate...');
  const sourceClient = await getWeaviateClient(sourceConfig);
  console.log('Connecting to target Weaviate...');
  const targetClient = await getWeaviateClient(targetConfig);

  await ensureCollection(targetClient);

  let after: string | undefined;
  let migrated = 0;

  while (true) {
    const query = sourceClient.graphql
      .get()
      .withClassName('Memory')
      .withFields(
        'userId category text importance factType goalStatus metadata createdAt updatedAt retrievalCount lastRetrievedAt _additional { id }',
      )
      .withLimit(batchSize);

    if (after) {
      query.withAfter(after);
    }

    const result = await query.do();
    const items = (result.data?.Get?.Memory ?? []) as any[];
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      const metadataRaw = item.metadata;
      let metadata: Record<string, unknown> | undefined;
      if (typeof metadataRaw === 'string' && metadataRaw.trim().length > 0) {
        try {
          metadata = JSON.parse(metadataRaw);
        } catch {
          metadata = undefined;
        }
      } else if (metadataRaw && typeof metadataRaw === 'object') {
        metadata = metadataRaw as Record<string, unknown>;
      }

      const memory: MemoryVector = {
        id: item._additional?.id ?? randomUUID(),
        userId: item.userId as string,
        category: item.category,
        text: item.text as string,
        importance: item.importance as 'low' | 'medium' | 'high',
        factType: item.factType ?? undefined,
        goalStatus: item.goalStatus ?? undefined,
        metadata,
        createdAt: item.createdAt ?? new Date().toISOString(),
        updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
        retrievalCount: item.retrievalCount ?? undefined,
        lastRetrievedAt: item.lastRetrievedAt ?? undefined,
      };

      try {
        await insertMemory(targetClient, memory);
        migrated += 1;
      } catch (error: any) {
        // Skip if memory already exists
        if (error?.message?.includes('already exists') || error?.message?.includes('422')) {
          console.log(`Skipping duplicate memory with id: ${memory.id}`);
          continue;
        }
        throw error;
      }
    }

    after = items[items.length - 1]?._additional?.id;
    console.log(`Migrated ${migrated} memories so far...`);
  }

  console.log(`Migration complete. Total memories migrated: ${migrated}`);
}

migrateMemories().catch((error) => {
  console.error('Failed to migrate Weaviate data:', error);
  process.exit(1);
});
