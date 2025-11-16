# Memory Manager Integration Check

> **Note (2025-11):** Firestore has been removed. All metadata now lives in Weaviate. References below to Firestore describe the legacy setup and have been replaced by the new `UserProfile`, `ConversationMeta`, and `Turn` classes.

## ✅ Weaviate Integration

### 1. Client Initialization
- ✅ Weaviate client initialized in `services/memory-manager/src/index.ts`
- ✅ Configuration loaded from environment variables (`WEAVIATE_HOST`, `WEAVIATE_PORT`, `WEAVIATE_SCHEME`, `WEAVIATE_API_KEY`)
- ✅ Default values: `localhost:8082` (http)

### 2. Memory Storage
- ✅ `POST /memory/:userId/store-candidate` stores memories in both:
- **Weaviate (structured classes)**: UserProfile, ConversationMeta, Turn metadata
  - **Weaviate**: Vector embeddings (automatic via text2vec-openai)
- ✅ Category-specific fields extracted from metadata:
  - `facts`: `metadata.type` → `factType` in Weaviate
  - `goals`: `metadata.status` → `goalStatus` in Weaviate

### 3. Memory Retrieval
- ✅ `POST /memory/:userId/retrieve-for-dialogue` uses Weaviate for semantic search:
  - When `query` is provided → uses `searchMemories()` from Weaviate
- When `query` is empty → falls back to recent entries from Weaviate `Memory`
- ✅ Filters by `userId` and `category` automatically
- ✅ Returns top-k results ranked by semantic similarity

## ✅ ACE Playbook Integration

### 1. Playbook Loading
- ✅ `loadPlaybook(userId)` loads from Weaviate `UserProfile.playbook`
- ✅ Returns `null` if no playbook exists (falls back to default behavior)
- ✅ Handles errors gracefully (logs and returns null)

### 2. Retrieval Strategies
- ✅ `applyRetrievalStrategies()` filters memories based on:
  - Playbook retrieval strategies
  - Current context (emotion, mode)
- ✅ Supports temporal filtering (e.g., "last 7 days")
- ✅ Supports category prioritization (e.g., prioritize gratitude)

### 3. Context Engineering Rules
- ✅ `applyContextEngineeringRules()` applies rules based on:
  - Playbook context engineering rules
  - Current query
- ✅ Filters memories based on rule conditions

### 4. Integration Flow
```
1. Load memories (Weaviate semantic search OR recent entries)
2. Load playbook from Weaviate `UserProfile`
3. Apply retrieval strategies (filter by emotion/mode)
4. Apply context engineering rules (filter by query)
5. Return filtered results with playbook version
```

## 🔍 Testing

### Run Integration Test
```bash
node scripts/test-memory-weaviate-ace.mjs [userId]
```

### Test Checklist
- [ ] Memory Manager health check
- [ ] Store memories in Weaviate
- [ ] Semantic search via Weaviate
- [ ] ACE playbook loading
- [ ] Fallback to recent entries (no query)

### Manual Verification

1. **Check Weaviate Connection**:
   ```bash
   curl http://localhost:8082/v1/.well-known/ready
   ```

2. **Check Memory Manager**:
   ```bash
   curl http://localhost:4103/healthz
   ```

3. **Store Test Memory**:
   ```bash
   curl -X POST http://localhost:4103/memory/test-user/store-candidate \
     -H "Content-Type: application/json" \
     -d '{"items":[{"category":"facts","text":"Test memory","importance":"medium"}]}'
   ```

4. **Retrieve with Semantic Search**:
   ```bash
   curl -X POST http://localhost:4103/memory/test-user/retrieve-for-dialogue \
     -H "Content-Type: application/json" \
     -d '{"query":"test"}'
   ```

## ⚠️ Common Issues

### Weaviate Not Running
- **Symptom**: `ECONNREFUSED` errors
- **Fix**: Start Weaviate: `docker-compose -f docker-compose.weaviate.yml up -d`

### Missing OpenAI API Key
- **Symptom**: Weaviate can't generate embeddings
- **Fix**: Set `OPENAI_API_KEY` in `.env`

### Playbook Not Found
- **Symptom**: `playbookVersion: null` in responses
- **Fix**: This is normal for new users. Playbook will be created by nightly agent.

### Schema Not Created
- **Symptom**: `Collection 'Memory' does not exist`
- **Fix**: Schema is auto-created on first `insertMemory()` call

## 📊 Monitoring

### Logs to Watch
- `[ACE] Applied playbook v...` - Confirms ACE is working
- Weaviate connection errors
- Weaviate connection errors

### Metrics to Track
- Memory retrieval latency
- Playbook application rate
- Weaviate search performance
