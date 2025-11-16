# Weaviate Schema Analysis & Design

## Architecture Analysis

Based on CareLink's architecture, the memory system needs to support:

### Memory Types

1. **Facts** (`category: 'facts'`)
   - Additional field: `type` → `family`, `hobby`, `health`, `routine`
   - Used for: Life facts, routines, personal information
   - Example: "My sister Olya lives in Lviv" (type: family)

2. **Goals** (`category: 'goals'`)
   - Additional field: `status` → `active`, `done`
   - Used for: User goals, habits, aspirations
   - Example: "I want to go for a walk at least three times a week" (status: active)

3. **Gratitude** (`category: 'gratitude'`)
   - Simple text entries
   - Used for: Gratitude journal entries
   - Example: "I'm grateful that I talked with my grandson today"

4. **Safety** (`category: 'safety'`)
   - Safety-related memories
   - Used for: Safety incidents, alerts, concerns

5. **Routine** (`category: 'routine'`)
   - Routine patterns
   - Used for: Daily routines, patterns

### Common Properties

All memory types share:
- `userId` - Multi-tenancy
- `category` - Memory type
- `text` - Main content (semantic search target)
- `importance` - Priority level (`low`, `medium`, `high`)
- `metadata` - Additional key-value data
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

### Schema Design Decision

**Single Collection vs Multiple Collections**

✅ **Decision: Single Collection (`Memory`)**

**Rationale:**
1. All memory types share the same core structure
2. Unified semantic search across all types
3. Easier filtering and querying
4. Category-specific fields handled via optional properties
5. Simpler codebase and maintenance

**Alternative Considered:**
- Separate collections per category (MemoryFacts, MemoryGoals, etc.)
- **Rejected** because:
  - Duplicates schema definition
  - Harder to search across categories
  - More complex queries

## Schema Properties

### Core Properties

| Property | Type | Indexed | Filterable | Searchable | Description |
|----------|------|---------|------------|------------|-------------|
| `userId` | string | ✅ | ✅ | ❌ | User ID for multi-tenancy |
| `category` | string | ✅ | ✅ | ❌ | Memory category |
| `text` | text | ✅ | ❌ | ✅ | Main content for semantic search |
| `importance` | string | ✅ | ✅ | ❌ | Priority level |
| `metadata` | object | ❌ | ❌ | ❌ | Additional data |
| `createdAt` | date | ✅ | ✅ | ❌ | Creation timestamp |
| `updatedAt` | date | ✅ | ✅ | ❌ | Update timestamp |

### Category-Specific Properties

| Property | Type | Used By | Values | Description |
|----------|------|---------|--------|-------------|
| `factType` | string | facts | `family`, `hobby`, `health`, `routine` | Fact classification |
| `goalStatus` | string | goals | `active`, `done` | Goal status |

### Analytics Properties (for ACE Playbooks)

| Property | Type | Description |
|----------|------|-------------|
| `retrievalCount` | int | Number of times retrieved |
| `lastRetrievedAt` | date | Last retrieval timestamp |

## Query Patterns

### 1. Semantic Search by Category

```typescript
// Find facts about family
const results = await searchMemories(
  client,
  "family members",
  userId,
  { category: 'facts', factType: 'family', limit: 10 }
);
```

### 2. Active Goals Only

```typescript
// Get active goals
const activeGoals = await searchMemories(
  client,
  "exercise",
  userId,
  { category: 'goals', goalStatus: 'active', limit: 5 }
);
```

### 3. High Importance Memories

```typescript
// Get high importance memories
const important = await searchMemories(
  client,
  query,
  userId,
  { importance: 'high', limit: 20 }
);
```

### 4. Minimum Importance Filter

```typescript
// Get medium and high importance
const important = await searchMemories(
  client,
  query,
  userId,
  { minImportance: 'medium', limit: 20 }
);
```

### 5. Temporal Filtering

```graphql
{
  Get {
    Memory(
      nearText: { concepts: ["books"] }
      where: {
        operator: And
        operands: [
          { path: ["userId"], operator: Equal, valueString: "user-123" }
          { path: ["createdAt"], operator: GreaterThan, valueDate: "2025-01-01T00:00:00Z" }
        ]
      }
      limit: 10
    ) {
      text
      category
      createdAt
    }
  }
}
```

## Indexing Strategy

### Vector Index (HNSW)
- **Purpose**: Fast approximate semantic search
- **Distance**: Cosine similarity
- **Configuration**: Optimized for 1536-dimensional vectors (text-embedding-3-small)

### Inverted Index (BM25)
- **Purpose**: Keyword search on `text` field
- **Configuration**: Word-level tokenization
- **Use Case**: Exact phrase matching, keyword filtering

### Filter Indexes
- **Purpose**: Fast filtering by userId, category, importance, factType, goalStatus
- **Configuration**: Field-level tokenization for exact matches
- **Use Case**: Multi-tenancy, category filtering, status filtering

## Performance Considerations

1. **Multi-tenancy**: Always filter by `userId` first (most selective)
2. **Category filtering**: Use category filter to reduce search space
3. **Importance**: Use importance for result prioritization
4. **Temporal**: Use createdAt for recency-based filtering
5. **Hybrid search**: Combine semantic (nearText) + keyword (BM25) for best results

## Data Storage Notes

- **Weaviate**: Stores vector embeddings and performs semantic search
- **Structured metadata**: Persisted directly in Weaviate (`UserProfile`, `ConversationMeta`, `Turn`)
- **Mapping examples**: 
  - Facts: `factType` field denotes categories such as family/hobby/health
  - Goals: `goalStatus` field tracks `active`/`done`
  - Embeddings: Generated automatically by Weaviate via text2vec-openai

## Best Practices

1. **Always filter by userId** - Required for multi-tenancy
2. **Use category filters** - Improves query performance
3. **Set importance appropriately** - Enables better prioritization
4. **Update retrievalCount** - Track usage for ACE playbooks
5. **Use factType/goalStatus** - Enables precise filtering
6. **Keep metadata lightweight** - Not indexed, use for non-searchable data
