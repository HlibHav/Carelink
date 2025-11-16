# Agent Interfaces & Tools

The original LangChain/LangGraph design has been replaced by plain TypeScript services. This document summarises how each “conceptual agent” is implemented so other docs that reference `agents-and-tools.md` remain accurate.

## Dialogue Agent Modules

| Module | Location | Purpose |
| --- | --- | --- |
| Listener | `agents/dialogue/src/orchestrator/listenerAgent.ts` | Runs an OpenAI JSON completion to extract summary, facts, intents, and coarse emotions from the transcript. |
| Emotion Classifier | `agents/dialogue/src/orchestrator/emotionAgent.ts` | Refines the emotional state and social need. |
| Memory Retrieval | `agents/dialogue/src/orchestrator/dialogueAgent.ts` → `clients/memoryManagerClient.ts` | Pulls facts/goals/gratitude + profile snapshot for the current user. |
| Mode Planner | `agents/dialogue/src/orchestrator/plannerAgent.ts` | Decides the conversational mode/goal. |
| Coach Generator | `agents/dialogue/src/orchestrator/coachAgent.ts` | Produces the final assistant text and reasoning. |
| Tone Selector | `agents/dialogue/src/orchestrator/toneAgent.ts` | Maps emotion/mode to one of the ElevenLabs tone presets. |
| Safety Command Subscriber | `agents/dialogue/src/subscribers/safetyCommandSubscriber.ts` | Listens for `safety.command.v1`, queues commands per user, and acknowledges receipt. |

All of these modules are simple functions that call OpenAI or manipulate in-memory state — no agent registry or LangChain tooling is involved.

## Coach Agent Modules

| Module | Location | Purpose |
| --- | --- | --- |
| Context Builder | `agents/coach/src/orchestrator/contextBuilder.ts` | Fetch goals/open loops and engine summaries. |
| Plan Generator | `agents/coach/src/orchestrator/planGenerator.ts` | Uses the `coach-plan-generator.md` prompt to create structured plans. |
| Scheduler/Notification Clients | `agents/coach/src/clients/*.ts` | Persist reminders and send notifications through the stub scheduling service. |
| Telemetry | `agents/coach/src/telemetry/logger.ts` | Structured JSON logs for observability. |

## Safety Agent Modules

| Module | Location | Purpose |
| --- | --- | --- |
| Safety Handler | `agents/safety/src/handlers/safetyHandler.ts` | Entry point for every alert/trigger. |
| Incident Evaluator | `agents/safety/src/evaluator/incidentEvaluator.ts` | LLM-guided decision making (monitor vs dialogue check vs escalation). |
| Dialogue Command Publisher | `agents/safety/src/clients/dialogueCommandClient.ts` | Sends prompts to Dialogue agent via `safety.command.v1`. |
| Notification Client | `agents/safety/src/clients/notificationClient.ts` | Issues caregiver/emergency notifications through the scheduling service. |
| Telemetry | `agents/safety/src/telemetry/logger.ts` | Structured JSON logs per trigger.

## Tools / External APIs

- **OpenAI** – STT, embeddings, and all LLM prompts.  
- **ElevenLabs** – text-to-speech.  
- **Weaviate (via Memory Manager)** – user state, memories, safety profiles.  
- **Scheduling Service** – stub service for reminders/notifications.  
- **Event Bus** – SSE-based pub/sub with a persistent backlog.

Whenever other docs mention “tools”, they now refer to these concrete modules and HTTP clients.
