# CareLink Gateway (Dialogue API)

This service is now the **edge gateway** for CareLink.  
It authenticates public clients, handles media uploads, and forwards requests to the internal engines/services that implement the CareLink architecture.

## Getting Started

1. **Install dependencies**
   ```bash
   cd apps/gateway
   npm install
   ```
2. **Run in development mode**
   ```bash
   npm run dev
   ```
3. **Environment variables**
   - `PORT` (default `8080`)
   - `ALLOWED_ORIGINS` – optional CSV for CORS (defaults to `5173` & `5174`)
   - `OPENAI_API_KEY` plus optional `OPENAI_*_MODEL` overrides for chat/emotion/planner/embeddings/Whisper
   - `PHOENIX_ENDPOINT` – placeholder for observability client
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` – configure the voice agent
   - `PHYSICAL_ENGINE_URL` – base URL of `engines/physical`
   - `MIND_BEHAVIOR_ENGINE_URL` – base URL of `engines/mind-behavior`
   - `MEMORY_MANAGER_URL` – base URL of `services/memory-manager`

Create a `.env` file if you want to run locally (trim to what you need):

```
PORT=8080
ALLOWED_ORIGINS=http://localhost:4000
OPENAI_API_KEY=sk-your-key
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
ELEVENLABS_API_KEY=your-xi-api-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MODEL_ID=eleven_flash_v2
PHYSICAL_ENGINE_URL=http://localhost:4101
MIND_BEHAVIOR_ENGINE_URL=http://localhost:4102
MEMORY_MANAGER_URL=http://localhost:4103
```

## API Documentation

📖 **Complete API Reference**: See [`API.md`](./API.md) for detailed documentation with curl examples, request/response samples, and JavaScript/TypeScript code examples.

### Quick Reference

| Endpoint | Description |
| --- | --- |
| `GET /healthz` | Liveness probe |
| `POST /api/start-conversation` | Creates a session and returns WebSocket/SSE endpoints |
| `POST /api/user-utterance` | Runs the multi-agent orchestrator (Whisper → LLM → RAG → ElevenLabs) for a session turn |
| `GET /api/session-summary?sessionId=...` | Returns nightly summary placeholder data |

All `/api/*` routes require:
- `Authorization: Bearer <token>`
- `X-User-Id`, `X-Device-Id` (required)
- `X-Client-Version` (optional)

`/api/user-utterance` additionally requires `X-Session-Id`.

## Architecture Highlights

- **Gateway-only responsibilities**: Authentication, payload validation, orchestration of downstream services, session bookkeeping.
- **Externalized engines**: Physical state + Mind & Behavior analytics now live in `engines/*` and are invoked via HTTP.
- **Memory Manager API**: All memory read/write is proxied through `services/memory-manager`, mirroring the contracts in `docs/architecture/carelink_system_spec_cursor_ready.md`.
- **Voice Output**: The gateway still integrates with ElevenLabs for low-latency TTS, while tone selection remains an agent skill.

## Next Steps

- Emit Phoenix spans covering every engine/service round-trip.
- Move Dialogue orchestrator prompts + reasoning into `agents/dialogue` and call them from the gateway.
- Replace the in-memory session store with Firestore or Redis.
- Implement SSE/WebSocket streaming so clients receive incremental transcripts/TTS chunks.
