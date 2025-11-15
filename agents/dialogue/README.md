# Dialogue Agent Service

This service hosts the Dialogue Orchestrator. It accepts `POST /turn` requests with `{ userId, sessionId, transcript, metadata }`, pulls state from the engines + Memory Manager, produces the next response (listener/emotion/plan/coach/tone), persists turns, and emits coach/safety triggers onto the Event Bus.

## Environment

| Variable | Description |
| --- | --- |
| `PORT` | Service port (default `4200`) |
| `OPENAI_API_KEY` (+ optional `OPENAI_*_MODEL`) | Models used for listener/emotion/coach/planner |
| `PHYSICAL_ENGINE_URL` | Base URL for `engines/physical` |
| `MIND_BEHAVIOR_ENGINE_URL` | Base URL for `engines/mind-behavior` |
| `MEMORY_MANAGER_URL` | Base URL for `services/memory-manager` |
| `EVENT_BUS_URL` | Base URL for `services/event-bus` |

Run locally with:

```bash
cd agents/dialogue
npm install
npm run dev
```

For production builds:

```bash
cd agents/dialogue
cp .env.example .env
npm install
npm run build
npm run start:prod
```

### Docker

```bash
cd agents/dialogue
docker build -t dialogue-agent .
docker run --env-file .env -p 4200:4200 dialogue-agent
```
