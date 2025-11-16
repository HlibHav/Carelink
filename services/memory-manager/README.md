# Memory Manager Service

The Memory Manager service handles real-time memory operations for CareLink conversations. It provides low-latency endpoints for storing and retrieving user memories during active conversations.

## Architecture

The Memory Manager follows a **day/night separation** pattern:

- **Daytime operations**: Real-time, low-latency endpoints for active conversations
- **Nightly operations**: Batch processing endpoints (currently stubs, will be moved to `agents/memory-nightly`)

## Daytime Operations

These endpoints are called during active conversations and prioritize speed:

- `POST /memory/:userId/store-candidate` - Store extracted memories (facts, goals, gratitude, etc.)
- `POST /memory/:userId/turns` - Store conversation turns in real-time
- `POST /memory/:userId/retrieve-for-dialogue` - Retrieve memories for dialogue orchestration
- `GET /memory/:userId/retrieve-for-coach` - Retrieve memories for coach agent
- `GET /memory/:userId/safety-profile` - Retrieve safety profile for safety agent
- `GET /healthz` - Health check

## Nightly Operations

These endpoints handle batch processing and can tolerate higher latency:

- `POST /memory/:userId/daily-digest` - Generate daily conversation digest (currently implemented here)
- `POST /memory/:userId/compress` - Compress old memories (stub, will be implemented in nightly agent)

**Note**: Nightly operations will eventually be moved to the `agents/memory-nightly` service as part of the ACE (Agentic Context Engineering) implementation.

## Storage

All conversational data now lives in **Weaviate**:

- `Memory` – Semantic facts/goals/gratitude (vectorized via `text2vec-openai`).
- `UserProfile` – Serialized profile, safety settings, playbook JSON (vectorizer disabled).
- `ConversationMeta` – Session metadata (mode, emotion snapshots, timestamps).
- `Turn` – Every dialogue turn for analytics/digests.

## Configuration

Environment variables:

- `PORT` - Server port (default: 4103)
- `WEAVIATE_URL` - Optional full cloud endpoint (preferred)
- `WEAVIATE_HOST`, `WEAVIATE_PORT`, `WEAVIATE_SCHEME` - Local fallback when not using `WEAVIATE_URL`
- `OPENAI_API_KEY` - OpenAI API key (required for text2vec-openai vectorizer)

## Development

```bash
npm run dev    # Start development server
npm run build  # Build TypeScript
npm start      # Run production build
```
