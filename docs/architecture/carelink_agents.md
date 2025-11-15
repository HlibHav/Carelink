# CareLink Agents Specification

## 1. Dialogue Orchestrator Agent

**Type:** LLM agent  
**Role:** Single conversational interface for CareLink.

### Responsibilities
- Convert user STT text into a structured view (Listener + Emotion classifier).
- Pull memories and engine summaries, run the Planner + Coach prompts, and persist turns.
- Emit downstream events (`coach.trigger.v1`, `safety.trigger.v1`).
- Consume `safety.command.v1` instructions and ensure the next response honours the safety prompt.

### Inputs
- STT text plus optional audio metadata.
- Listener result (facts, intents, raw emotion).
- Refined emotion classification.
- Memory Manager retrieval (facts/goals/gratitude, profile snapshot).
- Physical & Mind & Behavior engine summaries.
- Pending safety commands (dequeued from the Event Bus subscriber).

### Outputs
- User-facing responses (text + tone metadata passed to TTS).
- `store_candidate_memory` calls for new facts.
- `coach.trigger.v1` events when the planner selects the coach mode.
- `safety.trigger.v1` events when vitals or emotion trends indicate elevated risk.
- `safety.command.handled.v1` acknowledgements after executing a safety prompt.

---

## 2. Coach & Planning Agent

**Type:** LLM/logic agent  
**Role:** Generate structured care plans and follow-up tasks.

### Responsibilities
- Subscribe to `coach.trigger.v1` events from Dialogue.
- Build context from Memory Manager plus engine summaries.
- Run the coach plan generator prompt, store plan highlights back into memory, and emit `coach.plan.ready.v1`.
- Schedule micro-actions and notifications via the Scheduling service.

### Inputs
- Trigger metadata (`user_id`, `turn_id`, requested mode, reason).
- Memory Manager coach retrieval (goals/open loops).
- Physical & Mind & Behavior summaries.

### Outputs
- Structured plan JSON (`coach.plan.ready.v1`).
- `schedule-task` + `send-notification` calls for actionable items.
- Stored recommendations in Memory Manager for later retrieval.
- Telemetry logs for observability.

---

## 3. Safety & Escalation Agent

**Type:** Rule-based + LLM agent  
**Role:** Central emergency decision-maker.

### Responsibilities
- Subscribe to engine alert topics and `safety.trigger.v1` events.
- Fetch the user’s safety profile/safety history.
- Evaluate the incident (rules + LLM policy) and decide to monitor, run a dialogue check, or escalate.
- Issue `safety.command.v1` prompts to Dialogue agent, log incidents, and send caregiver/emergency notifications.

### Inputs
- `physical.alert.v1`, `mind_behavior.alert.v1`, `safety.trigger.v1` events.
- Safety profile from Memory Manager.
- Incident history (via `logIncident`).

### Outputs
- Dialogue instructions (`safety.command.v1`).
- Caregiver/emergency notifications via Scheduling service.
- Incident entries stored in Memory Manager.
- Telemetry covering trigger receipt, decision, and completion.

---

## 4. Memory Manager (Hybrid Agent/Service)

**Type:** Hybrid (service by day, agent by night)  
**Role:** Owns CareLink's memory about each user.

### Daytime Operations (services/memory-manager)
Real-time, low-latency service for active conversations:

- Store and categorize candidate memories (facts, events, emotional episodes, goals).
- Provide focused memory retrieval for dialogue, coaching, and safety.
- Health checks and monitoring.

### Nightly Operations (agents/memory-nightly)
Batch processing agent implementing ACE (Agentic Context Engineering):

- Generate daily digests from conversation logs.
- Compress and consolidate short-term memories into long-term representations.
- **ACE Playbook Evolution**: Generation → Reflection → Curation cycle to evolve retrieval strategies and context engineering rules.

### Inputs (Daytime)
- Candidate memories from Dialogue Orchestrator Agent and other modules.
- Conversation and interaction logs.
- Metadata such as importance, type, and domain.

### Outputs (Daytime)
- `retrieve_for_dialogue(user_id, context)` result sets.
- `retrieve_for_coach(user_id)` structured summaries.
- `get_safety_profile(user_id)` safety-focused slice of memory.

### Inputs (Nightly)
- User ID, date range for analysis.
- Conversation logs with execution traces.
- Retrieval effectiveness metrics (which memories were used, which weren't).
- Explicit feedback signals (if available).
- Current playbook state.

### Outputs (Nightly)
- Updated playbook entries (structured JSON) stored in `users/{userId}/playbooks/{playbookId}`.
- Compression artifacts.
- Daily digest documents.

### ACE Playbook Structure
Playbooks evolve through a generation-reflection-curation cycle:

- **Retrieval Strategies**: Condition-based rules for what memories to retrieve (e.g., "emotion=sadness AND mode=support → prioritize gratitude entries from last 7 days").
- **Context Engineering Rules**: Rules for filtering and prioritizing retrieved memories (e.g., "When user mentions family, include related facts even if similarity is lower").
- **Common Mistakes**: Documented mistakes and their corrections to prevent repetition.

See `memory-nightly-contract.md` for detailed API specifications.
