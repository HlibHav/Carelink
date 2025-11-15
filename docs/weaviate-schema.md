# Weaviate Schema Documentation

## Overview

CareLink uses Weaviate to store user memories (facts, goals, gratitude, safety, routine) with semantic search capabilities. The schema is defined in `packages/weaviate-client/src/schema.ts`.

## Collection: Memory

### Purpose
Stores user memories with full-text and semantic search capabilities for context retrieval during conversations.

### Vectorizer
- **Module**: `text2vec-openai`
- **Model**: `text-embedding-3-small`
- **Dimensions**: 1536
- **Distance**: Cosine similarity

### Properties

#### userId (string)
- **Purpose**: User ID for multi-tenancy
- **Indexed**: Yes (inverted index)
- **Filterable**: Yes
- **Searchable**: No
- **Tokenization**: Field (exact match)

#### category (string)
- **Purpose**: Memory category classification
- **Values**: `facts`, `goals`, `gratitude`, `safety`, `routine`
- **Indexed**: Yes (inverted index)
- **Filterable**: Yes
- **Searchable**: No
- **Tokenization**: Field (exact match)

#### text (text)
- **Purpose**: Main memory content - used for semantic and keyword search
- **Indexed**: Yes (inverted index for BM25)
- **Filterable**: No
- **Searchable**: Yes (BM25 keyword search)
- **Tokenization**: Word (word-level tokenization)

#### importance (string)
- **Purpose**: Importance level for prioritization
- **Values**: `low`, `medium`, `high`
- **Indexed**: Yes (inverted index)
- **Filterable**: Yes
- **Searchable**: No
- **Tokenization**: Field (exact match)

#### metadata (object)
- **Purpose**: Additional key-value metadata
- **Indexed**: No
- **Filterable**: No
- **Searchable**: No
- **Note**: Stored as-is, not indexed

#### createdAt (date)
- **Purpose**: Creation timestamp
- **Indexed**: Yes (inverted index)
- **Filterable**: Yes
- **Searchable**: No

#### updatedAt (date)
- **Purpose**: Last update timestamp
- **Indexed**: Yes (inverted index)
- **Filterable**: Yes
- **Searchable**: No

## Vector Index Configuration

- **Type**: HNSW (Hierarchical Navigable Small World)
- **Distance**: Cosine
- **ef**: 128 (dynamic candidate list size)
- **efConstruction**: 128 (construction candidate list size)
- **maxConnections**: 64 (max connections per node)

## Inverted Index Configuration

- **BM25 k1**: 1.2 (term frequency saturation)
- **BM25 b**: 0.75 (length normalization)
- **Stopwords**: English preset
- **Cleanup Interval**: 60 seconds

## Usage Examples

### Create Schema

```typescript
import { createMemorySchema, getWeaviateClient } from '@carelink/weaviate-client';

const client = getWeaviateClient();
await createMemorySchema(client);
```

### Query Examples

#### Semantic Search
```typescript
// Find memories semantically similar to query
const results = await searchMemories(
  client,
  "I love reading books",
  "user-123",
  { limit: 10 }
);
```

#### Filter by Category
```typescript
// Get only facts
const facts = await searchMemories(
  client,
  "books",
  "user-123",
  { category: 'facts', limit: 10 }
);
```

#### Filter by Importance
```graphql
{
  Get {
    Memory(
      nearText: { concepts: ["books"] }
      where: {
        path: ["importance"]
        operator: Equal
        valueString: "high"
      }
      limit: 10
    ) {
      text
      category
      importance
    }
  }
}
```

## Schema Management

### Create Schema
```typescript
import { createMemorySchema } from '@carelink/weaviate-client';
await createMemorySchema(client);
```

### Get Schema
```typescript
import { getMemorySchema } from '@carelink/weaviate-client';
const schema = await getMemorySchema(client);
```

### Delete Schema (⚠️ Deletes all data!)
```typescript
import { deleteMemorySchema } from '@carelink/weaviate-client';
await deleteMemorySchema(client);
```

## Migration Notes

- Schema is automatically created on first use via `ensureCollection()`
- Schema updates are limited - most changes require recreating the collection
- Always backup data before schema changes
- Use `deleteMemorySchema()` + `createMemorySchema()` for major updates

## Best Practices

1. **Multi-tenancy**: Always filter by `userId` in queries
2. **Category filtering**: Use category filter for better performance
3. **Importance**: Use importance for result prioritization
4. **Metadata**: Keep metadata lightweight, use for non-searchable data
5. **Timestamps**: Use createdAt/updatedAt for temporal queries

## Performance Considerations

- HNSW index provides fast approximate search
- BM25 enables efficient keyword search
- Filtering by userId and category improves query performance
- Consider sharding for large datasets (multi-node setup)

