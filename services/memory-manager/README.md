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

The service uses a **hybrid approach**:

### Weaviate (Vector Database)
- Stores vector embeddings for semantic search
- Collection: `Memory`
- Properties: userId, category, text, importance, factType, goalStatus, metadata, timestamps
- Automatic embedding generation via `text2vec-openai`

### Firestore (Metadata Storage)
- `users/{userId}` - Root user document
- `users/{userId}/profile` - User profile data
- `users/{userId}/facts` - Life facts metadata (references Weaviate via `weaviateId`)
- `users/{userId}/goals` - User goals metadata (references Weaviate via `weaviateId`)
- `users/{userId}/gratitude` - Gratitude entries metadata (references Weaviate via `weaviateId`)
- `users/{userId}/conversations/{sessionId}` - Conversation sessions
- `users/{userId}/conversations/{sessionId}/turns/{turnId}` - Conversation turns
- `users/{userId}/playbooks/{playbookId}` - ACE playbooks

## Configuration

Environment variables:

- `PORT` - Server port (default: 4103)
- `GOOGLE_PROJECT_ID` - Google Cloud project ID (for Firestore)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON (for Firestore)
- `FIRESTORE_EMULATOR_HOST` - Firestore emulator host (for local development)
- `WEAVIATE_HOST` - Weaviate host (default: localhost)
- `WEAVIATE_PORT` - Weaviate port (default: 8082)
- `WEAVIATE_SCHEME` - Weaviate scheme (http or https, default: http)
- `OPENAI_API_KEY` - OpenAI API key (required for text2vec-openai vectorizer)

## Development

```bash
npm run dev    # Start development server
npm run build  # Build TypeScript
npm start      # Run production build
```

