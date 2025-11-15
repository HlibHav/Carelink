# AI Architecture – Turn Orchestration & Agent Flows

CareLink’s AI experience is composed of a single conversational surface backed by multiple agents. Dialogue orchestrates each user turn and publishes internal events that Coach and Safety consume. This document summarises the current implementation rather than the legacy LangChain design.

## Dialogue Turn Pipeline

1. **Input & STT**  
   The gateway forwards authenticated requests to `agents/dialogue`. Audio is transcribed via OpenAI Whisper (see `apps/gateway/src/services/sttService.ts`). A raw transcript can also be supplied directly.

2. **Listener Agent**  
   `runListenerAgent` (OpenAI chat completion with `prompts/agent-mode-planner.md`) extracts:
   - concise summary
   - candidate facts (family, routines, goals)
   - intents
   - coarse emotion hints

3. **Emotion Classifier**  
   `refineEmotionState` re-evaluates the emotional state using the user profile, producing `primary`, `intensity`, `energy`, and `socialNeed` values. These feed the planner and tone selector.

4. **Context Assembly**  
   `buildConversationContext` pulls:
   - Memory Manager retrievals (facts/goals/gratitude, last mode/emotion)
   - Physical & Mind & Behavior summaries
   - Pending safety commands (dequeued from `safety_command_v1` subscriber)

5. **Mode Planner**  
   `planNextTurn` reasons about the best conversational mode (`support | coach | gratitude | game | reminder`). It also chooses the coaching goal and intensity. This call uses `prompts/agent-mode-planner.md`.

6. **Coach Response**  
   `generateCoachReply` (prompt = `system-life-companion` + `agent-coach`) produces:
   - final dialogue text
   - optional coach actions
   - reasoning metadata

7. **Tone Selection & TTS**  
   `determineTone` picks one of the eight ElevenLabs presets (warm empathic, serious direct, etc). The gateway later sends the text + tone to ElevenLabs to synthesise audio.

8. **Persistence & Events**  
   Dialogue writes both the user and assistant turns to Memory Manager, stores any extracted facts, and emits:
   - `coach.trigger.v1` when the planner selects the coach mode
   - `safety.trigger.v1` when emotion or vitals indicate elevated risk
   - `safety.command.handled.v1` after executing a safety prompt

If a queued `safety.command.v1` exists, it overrides the normal coach reply and forces a `serious_direct` tone so Safety agent instructions are delivered immediately.

## Coach Agent Flow

1. Subscribes to `coach.trigger.v1` via Event Bus.  
2. Fetches coach context (goals, open loops) and the latest engine summaries.  
3. Runs the plan generator prompt (`prompts/coach-plan-generator.md`).  
4. Stores recommendations in Memory Manager, emits `coach.plan.ready.v1`, and schedules reminders/notifications via the Scheduling service.  
5. Telemetry (`coachLog`) records every trigger, decision, and failure.

## Safety Agent Flow

1. Subscribes to `safety.trigger.v1`, `physical.alert.v1`, and `mind_behavior.alert.v1`.  
2. Fetches the user’s safety profile + incident history from Memory Manager.  
3. Evaluates the alert using a hybrid approach (rules + `evaluateIncident` LLM prompt).  
4. Depending on the outcome:
   - Publish `safety.command.v1` so Dialogue can check in with the user.
   - Send caregiver/emergency notifications via Scheduling service.
   - Log the incident back into Memory Manager for auditing.
5. Dialogue acknowledges via `safety.command.handled.v1` once the prompt is delivered.

## Event Contracts

See `docs/architecture/repo_structure.md` for the complete list. The most important flows today are:

- `coach.trigger.v1` → `coach.plan.ready.v1`
- `safety.trigger.v1` → `safety.command.v1` → `safety.command.handled.v1`
- Engine alert topics (`physical.alert.v1`, `mind_behavior.alert.v1`) which feed the Safety agent.

## Prompts & Configuration

- Dialogue prompts live in `prompts/system-life-companion.md`, `prompts/agent-coach.md`, `prompts/agent-emotion-classifier.md`, `prompts/agent-mode-planner.md`, and `prompts/agent-tone-selector.md`.
- Coach plan prompt: `prompts/coach-plan-generator.md`.
- All agents are configured via `.env` files (`OPENAI_*`, `EVENT_BUS_URL`, `MEMORY_MANAGER_URL`, etc). See each service’s README/config file for details.

This document replaces the legacy LangChain/LangGraph description; it mirrors the actual TypeScript services running in this repository.
