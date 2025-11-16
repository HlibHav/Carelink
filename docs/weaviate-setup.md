# Weaviate Setup Guide

## Overview

CareLink uses **local Weaviate** for vector-based memory storage. This provides:
- ✅ Full control over data
- ✅ No cloud costs for vector search
- ✅ Easy local development
- ✅ Open-source solution

## Architecture

- **Weaviate**: Stores embeddings plus structured metadata (user profiles, conversation sessions, playbooks, turns).

## Quick Start

### 1. Start Weaviate with Docker Compose

```bash
cd /Users/Glebazzz/Carelink
docker-compose -f docker-compose.weaviate.yml up -d
```

This starts Weaviate on:
- HTTP: `http://localhost:8082` (mapped from container port 8080)
- gRPC: `localhost:50051`

### 2. Configure Environment Variables

Add to `.env`:

```bash
# Weaviate Configuration
WEAVIATE_HOST=localhost
WEAVIATE_PORT=8082
WEAVIATE_SCHEME=http
WEAVIATE_API_KEY=  # Optional, not needed for local development

# OpenAI API Key (required for text2vec-openai vectorizer)
OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Verify Weaviate is Running

```bash
curl http://localhost:8082/v1/.well-known/ready
```

Should return: `{"ready":true}`

## Collection Schema

The `Memory` collection is automatically created with:

- **userId** (string): User ID for multi-tenancy
- **category** (string): Memory category (facts, goals, gratitude, safety, routine)
- **text** (text): Memory text content
- **importance** (string): Importance level (low, medium, high)
- **metadata** (object): Additional metadata
- **createdAt** (date): Creation timestamp
- **updatedAt** (date): Update timestamp

**Vectorizer**: `text2vec-openai` (uses OpenAI embeddings)

## API Usage

### Insert Memory

```typescript
import { getWeaviateClient, insertMemory } from '@carelink/weaviate-client';

const client = getWeaviateClient();
const memoryId = await insertMemory(client, {
  id: 'memory-123',
  userId: 'user-456',
  category: 'facts',
  text: 'I love reading books',
  importance: 'high',
  metadata: {},
  createdAt: new Date().toISOString(),
});
```

### Search Memories

```typescript
import { getWeaviateClient, searchMemories } from '@carelink/weaviate-client';

const client = getWeaviateClient();
const results = await searchMemories(
  client,
  'books and reading',
  'user-456',
  { limit: 10 }
);
```

## Docker Compose Configuration

The `docker-compose.weaviate.yml` file includes:

- **Image**: `semitechnologies/weaviate:1.24.0`
- **Ports**: 8080 (HTTP), 50051 (gRPC)
- **Modules**: `text2vec-openai`, `generative-openai`
- **Persistence**: Data stored in Docker volume `weaviate_data`
- **Anonymous Access**: Enabled for local development

## Production Considerations

For production, consider:

1. **Authentication**: Disable anonymous access, use API keys
2. **Persistence**: Use persistent volumes or cloud storage
3. **Backup**: Regular backups of Weaviate data
4. **Scaling**: Use Weaviate Cloud or multi-node setup
5. **Monitoring**: Set up monitoring and alerting

## Migration Notes

If you have existing data in another datastore:

1. Export embeddings and metadata
2. Import into Weaviate using batch operations

See `docs/weaviate-schema-analysis.md` for schema details.

## Troubleshooting

### Weaviate won't start

```bash
# Check logs
docker-compose -f docker-compose.weaviate.yml logs

# Check if port is already in use
lsof -i :8080
```

### Connection refused

- Verify Weaviate is running: `curl http://localhost:8080/v1/.well-known/ready`
- Check `WEAVIATE_HOST` and `WEAVIATE_PORT` in `.env`
- Ensure Docker container is running: `docker ps`

### OpenAI API key errors

- Verify `OPENAI_API_KEY` is set in `.env`
- Check Weaviate logs for API key errors
- Ensure OpenAI API key has sufficient credits

### Collection creation fails

- Check Weaviate logs for schema errors
- Verify OpenAI API key is accessible from Weaviate container
- Ensure text2vec-openai module is enabled

## Resources

- [Weaviate Documentation](https://weaviate.io/developers/weaviate)
- [Weaviate TypeScript Client](https://weaviate.io/developers/weaviate/client-libraries/typescript)
- [Weaviate Docker Setup](https://weaviate.io/developers/weaviate/installation/docker-compose)
