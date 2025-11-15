# Weaviate Web Interface Guide

## Overview

Weaviate provides several ways to interact with your data through web interfaces:

## 1. Built-in GraphQL Playground

Weaviate includes a built-in GraphQL Playground for querying your data.

### Access

- **URL**: `http://localhost:8082/v1/graphql`
- **Method**: Open in browser or use GraphQL client

### Example Query

```graphql
{
  Get {
    Memory(
      limit: 5
      where: {
        path: ["userId"]
        operator: Equal
        valueString: "test-user"
      }
    ) {
      userId
      category
      text
      importance
      createdAt
      _additional {
        id
        distance
      }
    }
  }
}
```

### Semantic Search Query

```graphql
{
  Get {
    Memory(
      nearText: {
        concepts: ["books and reading"]
      }
      limit: 10
      where: {
        path: ["userId"]
        operator: Equal
        valueString: "test-user"
      }
    ) {
      text
      category
      importance
      _additional {
        id
        distance
      }
    }
  }
}
```

## 2. REST API Endpoints

All Weaviate operations are available via REST API:

### Schema Operations

```bash
# Get schema
curl http://localhost:8082/v1/schema

# Create schema (via Memory Manager)
# Schema is auto-created on first insertMemory() call
```

### Data Operations

```bash
# Get objects
curl http://localhost:8082/v1/objects

# Get specific object
curl http://localhost:8082/v1/objects/{id}

# Search (via GraphQL)
curl -X POST http://localhost:8082/v1/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ Get { Memory(limit: 5) { text category } } }"}'
```

## 3. Weaviate Cloud Console (Optional)

For cloud instances, Weaviate offers a web-based console:

- **URL**: https://console.weaviate.io
- **Requires**: Weaviate Cloud account
- **Note**: Not needed for local development

## 4. Using Memory Manager API (Recommended)

For CareLink, use the Memory Manager API which handles Weaviate integration:

```bash
# Store memory
curl -X POST http://localhost:4103/memory/test-user/store-candidate \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "category": "facts",
      "text": "I love reading books",
      "importance": "high"
    }]
  }'

# Search memories
curl -X POST http://localhost:4103/memory/test-user/retrieve-for-dialogue \
  -H "Content-Type: application/json" \
  -d '{"query": "books"}'
```

## 5. Alternative Tools

### Postman / Insomnia

Import Weaviate REST API endpoints:
- Base URL: `http://localhost:8082/v1`
- Endpoints: `/schema`, `/objects`, `/graphql`

### GraphQL Clients

- **GraphiQL**: Browser extension or standalone app
- **Altair GraphQL**: Desktop client
- **Postman**: Supports GraphQL queries

## Quick Access Links

For local Weaviate instance:

- **GraphQL Playground**: http://localhost:8082/v1/graphql
- **REST API**: http://localhost:8082/v1
- **Schema**: http://localhost:8082/v1/schema
- **Meta**: http://localhost:8082/v1/meta
- **Health**: http://localhost:8082/v1/.well-known/ready

## Troubleshooting

### GraphQL Playground Not Loading

1. Check Weaviate is running:
   ```bash
   docker-compose -f docker-compose.weaviate.yml ps
   ```

2. Check port mapping:
   ```bash
   # Should show port 8082:8080
   docker ps | grep weaviate
   ```

3. Verify Weaviate is ready:
   ```bash
   curl http://localhost:8082/v1/.well-known/ready
   ```

### CORS Issues

If accessing from browser, ensure CORS is enabled in Weaviate config (already configured in `docker-compose.weaviate.yml`).

## Example: View All Memories

```graphql
{
  Get {
    Memory(limit: 100) {
      userId
      category
      text
      importance
      factType
      goalStatus
      createdAt
      _additional {
        id
      }
    }
  }
}
```

## Example: Search by User

```graphql
{
  Get {
    Memory(
      where: {
        path: ["userId"]
        operator: Equal
        valueString: "test-user-123"
      }
      limit: 20
    ) {
      text
      category
      importance
      createdAt
    }
  }
}
```

