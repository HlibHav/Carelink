import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

import { getWeaviateClient } from '@carelink/weaviate-client';

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

async function clearMemories() {
  const client = await getWeaviateClient();
  const limit = Number(process.env.WEAVIATE_DELETE_BATCH_SIZE ?? 100);
  let after: string | undefined;
  let deleted = 0;

  while (true) {
    const query = client.graphql
      .get()
      .withClassName('Memory')
      .withFields('_additional { id }')
      .withLimit(limit);

    if (after) {
      query.withAfter(after);
    }

    const result = await query.do();
    const items = (result.data?.Get?.Memory ?? []) as any[];
    if (!items.length) {
      break;
    }

    for (const item of items) {
      const id = item._additional?.id;
      if (!id) {
        continue;
      }
      await client.data.deleter().withClassName('Memory').withId(id).do();
      deleted += 1;
    }

    after = items[items.length - 1]?._additional?.id;
    console.log(`Deleted ${deleted} memories so far...`);
  }

  console.log(`Deletion complete. Total removed: ${deleted}`);
}

clearMemories().catch((error) => {
  console.error('Failed to clear Weaviate data:', error);
  process.exit(1);
});
