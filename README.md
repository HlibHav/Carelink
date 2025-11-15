# CareLink – Elder Support AI Platform

CareLink is a multi-service platform that delivers a single conversational companion while keeping reasoning, analytics, and infrastructure isolated. Every runtime component maps to the canonical spec in `docs/architecture/carelink_system_spec_cursor_ready.md`:

- **Agents** orchestrate LLM reasoning (`agents/dialogue`, `agents/coach`, `agents/safety`).
- **Engines** compute deterministic analytics (`engines/physical`, `engines/mind-behavior`).
- **Services** provide infrastructure primitives (`services/event-bus`, `services/memory-manager`, `services/scheduling`).
- **Apps** expose the user/API surfaces (`apps/gateway`, `frontend`).

The repository is organised so each agent/engine/service can run independently during development.

## Repository Layout

| Path | Description |
| --- | --- |
| `agents/dialogue` | Runs Listener → Emotion → Planner → Coach pipeline, persists turns, emits coach/safety events, and consumes `safety.command.v1` instructions. |
| `agents/coach` | Subscribes to `coach.trigger.v1`, generates plans (`prompts/coach-plan-generator.md`), schedules reminders, and emits `coach.plan.ready.v1`. |
| `agents/safety` | Listens to `safety.trigger.v1` + engine alerts, evaluates incidents, issues dialogue commands, and notifies caregivers or emergency contacts. |
| `engines/physical` | Mock vitals analytics service (`/state`, `/trends`, `/alerts/stream`). |
| `engines/mind-behavior` | Mock emotional/cognitive/social/routine analytics service. |
| `services/event-bus` | SSE bus with a persistent backlog used by all agents. |
| `services/memory-manager` | Weaviate + Firestore API for storing turns, memories, and safety profiles. Weaviate handles semantic search, Firestore stores metadata. |
| `services/scheduling` | Stub scheduling/notification API used by Coach and Safety agents. |
| `apps/gateway` | Public HTTP API (Express) that validates requests and fans out to Dialogue agent + ElevenLabs. |
| `frontend` | Developer playground for driving the backend and hosted ElevenLabs widget. |

Documentation is under `docs/` and mirrors this structure:

- `docs/architecture/carelink_system_spec_cursor_ready.md` – canonical spec.  
- `docs/architecture/carelink_agents.md` / `carelink_services.md` / `carelink_engines.md` – deep dives.  
- `docs/ai-architecture.md` – dialogue orchestration flow.  
- `docs/architecture/repo_structure.md` – event contracts and service map.  
- `docs/elevenlabs-agent-setup.md` – configuring the hosted agent experience.

## Running the Stack

Each service is a plain Node/TypeScript project with `npm run dev`. For convenience use the helper script once your `.env` files are ready:

```bash
./scripts/run-stack.sh
```

The script starts, in order, `event-bus`, `memory-manager`, `scheduling`, `engines/*`, `agents/*`, `apps/gateway`, and the Vite frontend. Press `Ctrl+C` once to terminate all subprocesses.

### Running services manually

```bash
cd services/event-bus && npm install && npm run dev
cd services/memory-manager && npm install && npm run dev
cd services/scheduling && npm install && npm run dev
cd agents/dialogue && npm install && npm run dev
cd agents/coach && npm install && npm run dev
cd agents/safety && npm install && npm run dev
cd apps/gateway && npm install && npm run dev
cd frontend && npm install && npm run dev
```

The frontend proxies API calls to `http://localhost:8080` by default and includes the ElevenLabs widget/Voice Orb for testing.

### Safety workflow smoke test

The Python helper spins up the critical services and pushes a sample `safety.trigger.v1` event:

```bash
python3 scripts/test-safety-agent.py
```

It requires `aiohttp` (install via `python3 -m pip install aiohttp`). The script publishes an alert and prints the Event Bus response; stop it once you have observed the agent logs.

## Testing & Diagnostics

- **Coach agent unit tests:** `cd agents/coach && npx vitest run` (covers plan generation + telemetry).
- **Manual integration:** use the frontend playground or `scripts/test-safety-agent.py` to verify alert → safety command → dialogue flow.
- **Event Bus backlog:** `GET http://localhost:4300/events/stream/<topic>?lastEventId=<id>` replays buffered events, which is useful when restarting agents.

## Additional References

1. `docs/architecture/carelink_system_spec_cursor_ready.md` – source of truth for responsibilities and APIs.  
2. `docs/ai-architecture.md` – detailed dialogue/coaching flow, prompts, and tone map.  
3. `docs/architecture/carelink_agents.md` – per-agent responsibilities, triggers, and outputs.  
4. `docs/architecture/carelink_services.md` – scheduling, memory, event bus, and notification contracts.  
5. `prompts/` – all LLM prompts referenced by the agents.
