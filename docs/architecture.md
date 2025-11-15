# System Architecture

CareLink now runs as a collection of small Node/TypeScript services that communicate through HTTP and an Event Bus. This replaces the earlier single-service/LangChain deployment.

## High-Level Components

1. **Apps**  
   - `apps/gateway`: authenticated HTTP API for clients.  
   - `frontend`: developer playground + ElevenLabs widget.

2. **Agents**  
   - `agents/dialogue`: orchestrates Listener → Emotion → Planner → Coach pipeline per user turn, persists memories, and emits safety/coach triggers.  
   - `agents/coach`: listens to `coach.trigger.v1`, generates plans, schedules reminders, and emits `coach.plan.ready.v1`.  
   - `agents/safety`: consumes safety/engine alerts, evaluates policy, issues dialogue commands, and notifies caregivers/emergency contacts.

3. **Engines**  
   - `engines/physical`: deterministic mock vitals analytics.  
   - `engines/mind-behavior`: deterministic mock emotional/cognitive/social analytics.

4. **Shared Services**  
   - `services/event-bus`: SSE transport with backlog replay support.  
   - `services/memory-manager`: Firestore-backed API for turns, facts, goals, safety profiles.  
   - `services/scheduling`: stub scheduling/notification service used by Coach and Safety.

5. **External Providers**  
   - OpenAI (STT, LLM prompts, embeddings).  
   - ElevenLabs (single multi-tone voice).  
   - Firestore (persisted through Memory Manager).

## Runtime Flow (Simplified)

```
Client → Gateway → Dialogue Agent → Memory Manager / Engines
                             ↘ (events) coach.trigger.v1 → Coach Agent → Scheduling Service
                              ↘ (events) safety.trigger.v1 → Safety Agent → Scheduling Service / Dialogue Command
                              ↙ safety.command.v1 (back into Dialogue)
```

- The Event Bus is the glue between agents. Each agent subscribes via `GET /events/stream/:topic?lastEventId=<id>` and publishes with `POST /events`.  
- Memory Manager stores every turn, extracted fact, plan, and safety incident so all components share a consistent state.

## Deployment Notes

- Every service exposes `/healthz` for container health checks.  
- Default localhost ports:
  - Event Bus `:4300`
  - Memory Manager `:4103`
  - Scheduling `:4205`
  - Physical Engine `:4101`
  - Mind & Behavior Engine `:4102`
  - Dialogue Agent `:4200`
  - Coach Agent `:4201`
  - Safety Agent `:4202`
  - Gateway `:8080`
  - Frontend `:5173`

The legacy “single backend” description is deprecated; this file now documents the actual services and wiring present in the repository.
