# LifeCompanion – Voice-First AI Companion & Coach

LifeCompanion is a voice-first AI companion for older adults that combines:
- **OpenAI** for reasoning, coaching, emotion understanding, and semantic memory (RAG)
- **ElevenLabs** for a single warm, emotionally-adaptive voice
- **Google Cloud Run + Firestore** for backend + memory
- (Optional later) **Featherless / Verda** for custom models at scale

The agent:
- **Initiates conversations** (not just reacts)
- Tracks **mood, routines, gratitude, health context (mocked Apple Watch data)** 
- Switches between modes: *support*, *coach*, *gratitude*, *game*
- Uses **one stable voice** with multiple emotional tones (warm, calming, playful, serious)
- Maintains **long-term memory** of the person’s life, goals, and stories

This repo contains **project documentation** you can drop into Cursor or any IDE to start building:
- Tech stack
- System & AI architecture
- Functional / non-functional requirements
- Agent prompts
- Memory specification
- Observability with Phoenix
- Evals plan

## Folder Structure

- `README.md` – high-level overview
- `docs/`
  - `architecture.md` – system architecture (backend, frontend, infra)
  - `ai-architecture.md` – agents, modes, flows
  - `requirements.md` – functional & non-functional requirements
  - `technical-design.md` – detailed design decisions
  - `tools-and-apis.md` – external services and how to use them
  - `memory.md` – Firestore schema + semantic memory (RAG)
  - `observability-phoenix.md` – logging and tracing LLM flows with Phoenix
  - `evals.md` – evaluation strategy for the agent
- `prompts/`
  - `system-life-companion.md`
  - `agent-mode-planner.md`
  - `agent-emotion-classifier.md`
  - `agent-coach.md`
  - `agent-tone-selector.md`

Start by reading:

1. `docs/architecture.md`
2. `docs/ai-architecture.md`
3. `docs/technical-design.md`
4. `prompts/system-life-companion.md`

Then scaffold the backend (Cloud Run service with Node/TS) and plug in OpenAI + ElevenLabs using this doc set. A starter Express/TypeScript implementation now lives in `backend/` with the documented REST endpoints so you can begin wiring the orchestration loop immediately.
