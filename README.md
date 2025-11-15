# CareLink – Elder Support AI System

CareLink is the production evolution of the LifeCompanion concept.  
It separates responsibilities into **Agents**, **Engines**, and **Services** exactly as described in `docs/architecture/carelink_system_spec_cursor_ready.md`.

Core pillars:
- **Dialogue Agent** provides a warm, multimodal interface.
- **Coach + Safety Agents** reason over deterministic outputs from the engines.
- **Physical Health Engine** and **Mind & Behavior Engine** compute trends/alerts from sensor and conversational signals.
- **Memory Manager** exposes deterministic APIs for storing/retrieving user memories, goals, and safety profiles.
- **Gateway App** is now a thin authenticated API surface that forwards requests to the internal mesh.

## Folder Structure

- `README.md` – high-level overview
- `docs/`
  - `architecture.md` – system architecture (backend, frontend, infra)
  - `ai-architecture.md` – agents, modes, flows
  - `requirements.md` – functional & non-functional requirements
  - `technical-design.md` – detailed design decisions
  - `tools-and-apis.md` – external services and how to use them
  - `elevenlabs-agent-setup.md` – ElevenLabs agent creation + embedding workflow
  - `memory.md` – Firestore schema + semantic memory (RAG)
  - `observability-phoenix.md` – logging and tracing LLM flows with Phoenix
  - `evals.md` – evaluation strategy for the agent
- `prompts/`
  - `system-life-companion.md`
  - `agent-mode-planner.md`
  - `agent-emotion-classifier.md`
  - `agent-coach.md`
  - `agent-tone-selector.md`
<<<<<<< HEAD
- `agents/`
  - `dialogue/` – Dialogue Orchestrator service calling engines/memory and publishing bus events.
  - `coach/` – Event-driven coach agent (subscribes to `coach.trigger.v1`).
  - `safety/` – Event-driven safety/escalation agent (subscribes to `safety.trigger.v1`).
  - `memory-nightly/` – _reserved_ for compression/digest automation.
=======
- `agents/`
  - `dialogue/` – Dialogue Orchestrator service calling engines/memory and publishing bus events.
  - `coach/` – Event-driven coach agent (subscribes to `coach.trigger.v1`).
  - `safety/` – Event-driven safety/escalation agent (subscribes to `safety.trigger.v1`).
  - `memory-nightly/` – _reserved_ for compression/digest automation.
>>>>>>> origin/main
- `engines/`
  - `physical/` – deterministic vitals analytics stub + alert stream.
  - `mind-behavior/` – unified emotional/cognitive/social/routine analytics stub.
- `services/`
  - `memory-manager/` – HTTP API matching CareLink’s memory contracts.
  - `event-bus/` – SSE relay for publishing/consuming the architecture contracts.
  - `scheduling/` – deterministic scheduling and notification stub.
<<<<<<< HEAD
  - `event-bus/` – SSE relay for publishing/consuming the architecture contracts.
=======
>>>>>>> origin/main
- `apps/`
  - `gateway/` – public HTTP API (dialogue gateway).
  - `frontend/` – developer-facing UI (still under `frontend/` directory).

Start by reading:

1. `docs/architecture/carelink_system_spec_cursor_ready.md`
2. `docs/architecture/repo_structure.md`
3. `docs/ai-architecture.md`
4. `prompts/system-life-companion.md`

<<<<<<< HEAD
Then run the stub services (`services/event-bus`, `engines/*`, `services/memory-manager`, `agents/dialogue`, `agents/coach`, `agents/safety`) alongside `apps/gateway` to exercise the end-to-end pipeline.
=======
Then run the stub services (`services/event-bus`, `engines/*`, `services/memory-manager`, `agents/dialogue`, `agents/coach`, `agents/safety`) alongside `apps/gateway` to exercise the end-to-end pipeline.
>>>>>>> origin/main
