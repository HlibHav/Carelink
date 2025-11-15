# LifeCompanion Backend

TypeScript/Express scaffolding for the voice-first LifeCompanion service described in `/docs`. It exposes the core REST endpoints so the frontend and orchestration layers can start integrating while AI agents and health integrations are built.

## Getting Started

1. **Install dependencies**
   ```bash
   cd backend
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
   - `GOOGLE_PROJECT_ID` and application credentials for Firestore
   - `FIRESTORE_EMULATOR_HOST` if you prefer running against the emulator (`localhost:8080`)
   - `PHOENIX_ENDPOINT` – placeholder for observability client
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` – configure the voice agent

Create a `.env` file if you want to run locally (trim to what you need):

```
PORT=8080
ALLOWED_ORIGINS=http://localhost:4000
OPENAI_API_KEY=sk-your-key
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
GOOGLE_PROJECT_ID=lifecompanion-dev
# FIRESTORE_EMULATOR_HOST=localhost:8080
ELEVENLABS_API_KEY=your-xi-api-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MODEL_ID=eleven_flash_v2
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

- **Orchestrator Pipeline**: `/api/user-utterance` now executes the full pipeline (Whisper STT → Listener & Emotion agents → Planner → Coach → Tone selector → ElevenLabs TTS) and returns the generated reply + base64 audio.
- **OpenAI Integration**: configurable models for LLM, planner, emotion classifier, embeddings, and transcription.
- **Memory & RAG**: Firestore stores user turns plus extracted facts/goals/gratitude with embeddings; a lightweight cosine RAG feeds context into the agents.
- **Voice Output**: The official ElevenLabs API produces natural audio aligned with the planner’s selected tone.

## Next Steps

- Emit Phoenix spans for every pipeline step.
- Replace the in-memory session store with Firestore or Redis.
- Implement SSE/WebSocket streaming so clients receive incremental transcripts/tts chunks.
