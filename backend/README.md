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
   - `ALLOWED_ORIGINS` – optional CSV for CORS
   - `PHOENIX_ENDPOINT` – placeholder for observability client
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` – configure the voice agent

Create a `.env` file if you want to run locally:

```
PORT=8080
ALLOWED_ORIGINS=http://localhost:5173
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
| `POST /api/user-utterance` | Accepts an audio (multipart) or transcript payload for a session turn |
| `GET /api/session-summary?sessionId=...` | Returns nightly summary placeholder data |

All `/api/*` routes require:
- `Authorization: Bearer <token>`
- `X-User-Id`, `X-Device-Id` (required)
- `X-Client-Version` (optional)

`/api/user-utterance` additionally requires `X-Session-Id`.

## Next Steps

- Replace in-memory stores with Firestore persistence + LangGraph orchestrator calls.
- Hook `utteranceService` up to Whisper STT, emotion/mode agents, and ElevenLabs streaming.
- Emit Phoenix spans from each service step once the observability client is wired.
