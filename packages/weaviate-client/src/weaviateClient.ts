// Using weaviate-ts-client v1.x API (TypeScript client)
// Note: The Python examples provided use v4.x, but TypeScript client uses different API
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import type { MemoryVector, WeaviateConfig, SearchOptions, SearchResult } from './types.js';
import { createMemorySchema, MEMORY_COLLECTION_SCHEMA } from './schema.js';

const COLLECTION_NAME = 'Memory';

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getWeaviateClient(config?: WeaviateConfig): Promise<WeaviateClient> {
  const headers: Record<string, string> = {};
  if (config?.headers) {
    Object.assign(headers, config.headers);
  }
  if (process.env.OPENAI_API_KEY && !headers['X-OpenAI-Api-Key']) {
    headers['X-OpenAI-Api-Key'] = process.env.OPENAI_API_KEY;
  }

  const apiKeyValue = config?.apiKey || process.env.WEAVIATE_API_KEY;
  const cloudUrl = config?.url || process.env.WEAVIATE_URL;
  const clientConfig: {
    host: string;
    scheme: 'http' | 'https';
    apiKey?: ApiKey;
    headers?: Record<string, string>;
  } = (() => {
    if (cloudUrl) {
      // Allow WEAVIATE_URL without scheme (e.g. "xyz.weaviate.cloud") by defaulting to https
      const normalizedUrl =
        /^https?:\/\//i.test(cloudUrl) ? cloudUrl : `https://${cloudUrl}`;
      const parsed = new URL(normalizedUrl);
      const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
      const scheme = parsed.protocol === 'https:' ? 'https' : 'http';
      return { host, scheme };
    }

    const host = config?.host || process.env.WEAVIATE_HOST || 'localhost';
    const port = config?.port || parseInt(process.env.WEAVIATE_PORT || '8080', 10);
    const scheme = config?.scheme || (process.env.WEAVIATE_SCHEME === 'https' ? 'https' : 'http');
    return { host: `${host}:${port}`, scheme };
  })();

  if (apiKeyValue) {
    clientConfig.apiKey = new ApiKey(apiKeyValue);
  }

  if (Object.keys(headers).length > 0) {
    clientConfig.headers = headers;
  }

  return weaviate.client(clientConfig);
}

export async function ensureCollection(client: WeaviateClient): Promise<void> {
  await createMemorySchema(client);
}

export async function insertMemory(
  client: WeaviateClient,
  memory: MemoryVector
): Promise<string> {
  await ensureCollection(client);
  
  // Build properties object with category-specific fields
  const properties: Record<string, unknown> = {
    userId: memory.userId,
    category: memory.category,
    text: memory.text,
    importance: memory.importance,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt || memory.createdAt,
  };

  if (memory.metadata && Object.keys(memory.metadata).length > 0) {
    properties.metadata = JSON.stringify(memory.metadata);
  }

  // Add category-specific fields
  if (memory.category === 'facts' && memory.factType) {
    properties.factType = memory.factType;
  }
  
  if (memory.category === 'goals' && memory.goalStatus) {
    properties.goalStatus = memory.goalStatus;
  }

  // Add analytics fields if provided
  if (memory.retrievalCount !== undefined) {
    properties.retrievalCount = memory.retrievalCount;
  }
  
  if (memory.lastRetrievedAt) {
    properties.lastRetrievedAt = memory.lastRetrievedAt;
  }

  const builder = client.data
    .creator()
    .withClassName(COLLECTION_NAME)
    .withId(memory.id)
    .withProperties(properties);

  // Only add vector if provided
  if (memory.embedding && memory.embedding.length > 0) {
    builder.withVector(memory.embedding);
  }

  const result = await builder.do();

  return result.id || memory.id;
}

export async function searchMemories(
  client: WeaviateClient,
  query: string,
  userId: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  await ensureCollection(client);
  
  const limit = options.limit || 10;
  
  // Build where filter - combine userId and optional filters
  const filters: any[] = [
    {
      path: ['userId'],
      operator: 'Equal',
      valueString: userId,
    },
  ];

  // Category filter
  if (options.category) {
    filters.push({
      path: ['category'],
      operator: 'Equal',
      valueString: options.category,
    });
  }

  // Fact type filter (only for facts)
  if (options.factType && options.category === 'facts') {
    filters.push({
      path: ['factType'],
      operator: 'Equal',
      valueString: options.factType,
    });
  }

  // Goal status filter (only for goals)
  if (options.goalStatus && options.category === 'goals') {
    filters.push({
      path: ['goalStatus'],
      operator: 'Equal',
      valueString: options.goalStatus,
    });
  }

  // Importance filter
  if (options.importance) {
    filters.push({
      path: ['importance'],
      operator: 'Equal',
      valueString: options.importance,
    });
  }

  // Minimum importance filter (greater than or equal)
  if (options.minImportance) {
    const importanceOrder: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 1, high: 2 };
    const minValue = importanceOrder[options.minImportance];
    
    // For each importance level >= minImportance
    const importanceFilters: any[] = [];
    if (minValue <= 0) importanceFilters.push({ path: ['importance'], operator: 'Equal', valueString: 'low' });
    if (minValue <= 1) importanceFilters.push({ path: ['importance'], operator: 'Equal', valueString: 'medium' });
    if (minValue <= 2) importanceFilters.push({ path: ['importance'], operator: 'Equal', valueString: 'high' });
    
    if (importanceFilters.length > 0) {
      filters.push({
        operator: 'Or',
        operands: importanceFilters,
      });
    }
  }

  // Combine filters with AND
  const whereClause: any =
    filters.length === 1
      ? filters[0]
      : {
          operator: 'And',
          operands: filters,
        };

  // Perform semantic search with nearText
  const builder = client.graphql
    .get()
    .withClassName(COLLECTION_NAME)
    .withFields('userId category text importance factType goalStatus metadata createdAt updatedAt retrievalCount lastRetrievedAt _additional { id distance }')
    .withNearText({
      concepts: [query],
    })
    .withWhere(whereClause)
    .withLimit(limit);

  const result = await builder.do();

  const objects = (result.data?.Get?.[COLLECTION_NAME] || []) as any[];

  return objects.map((obj) => ({
    id: obj._additional?.id || '',
    properties: {
      userId: obj.userId as string,
      category: obj.category as MemoryVector['category'],
      text: obj.text as string,
      importance: obj.importance as MemoryVector['importance'],
      factType: obj.factType as MemoryVector['factType'] | undefined,
      goalStatus: obj.goalStatus as MemoryVector['goalStatus'] | undefined,
      metadata: parseMetadata(obj.metadata),
      createdAt: obj.createdAt as string,
      updatedAt: obj.updatedAt as string | undefined,
      retrievalCount: obj.retrievalCount as number | undefined,
      lastRetrievedAt: obj.lastRetrievedAt as string | undefined,
    },
    distance: obj._additional?.distance as number | undefined,
    score: undefined, // GraphQL API doesn't return score directly
    vector: undefined, // Not returned by default
  }));
}

export async function deleteMemory(client: WeaviateClient, id: string): Promise<void> {
  await client.data
    .deleter()
    .withClassName(COLLECTION_NAME)
    .withId(id)
    .do();
}

export async function getMemoryById(
  client: WeaviateClient,
  id: string
): Promise<MemoryVector | null> {
  const result = await client.data
    .getterById()
    .withClassName(COLLECTION_NAME)
    .withId(id)
    .do();
  
  if (!result || !result.properties) {
    return null;
  }

  return {
    id: result.id || id,
    userId: result.properties.userId as string,
    category: result.properties.category as MemoryVector['category'],
    text: result.properties.text as string,
    importance: result.properties.importance as MemoryVector['importance'],
    factType: result.properties.factType as MemoryVector['factType'] | undefined,
    goalStatus: result.properties.goalStatus as MemoryVector['goalStatus'] | undefined,
    metadata: (result.properties.metadata as Record<string, unknown>) || {},
    createdAt: result.properties.createdAt as string,
    updatedAt: result.properties.updatedAt as string | undefined,
    retrievalCount: result.properties.retrievalCount as number | undefined,
    lastRetrievedAt: result.properties.lastRetrievedAt as string | undefined,
  };
}

export async function updateMemory(
  client: WeaviateClient,
  id: string,
  updates: Partial<Omit<MemoryVector, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const existing = await getMemoryById(client, id);
  if (!existing) {
    throw new Error(`Memory with id ${id} not found`);
  }

  // Build update properties
  const updateProperties: Record<string, unknown> = {
    userId: existing.userId,
    category: existing.category,
    text: existing.text,
    importance: existing.importance,
    metadata: existing.metadata || {},
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  // Preserve category-specific fields
  if (existing.factType) updateProperties.factType = existing.factType;
  if (existing.goalStatus) updateProperties.goalStatus = existing.goalStatus;
  if (existing.retrievalCount !== undefined) updateProperties.retrievalCount = existing.retrievalCount;
  if (existing.lastRetrievedAt) updateProperties.lastRetrievedAt = existing.lastRetrievedAt;

  // Apply updates
  Object.assign(updateProperties, updates);

  await client.data
    .updater()
    .withClassName(COLLECTION_NAME)
    .withId(id)
    .withProperties(updateProperties)
    .do();
}
