# CareLink Agents Specification

## 1. Dialogue Orchestrator Agent

**Type:** LLM agent  
**Role:** Single conversational interface of CareLink.

### Responsibilities
- Interpret user speech/text and emotional state.
- Retrieve relevant memories and state summaries from engines.
- Generate empathetic, context-aware responses.
- Trigger Coach & Planning Agent and Global Safety & Escalation Agent when needed.
- Submit candidate memories to the Memory Manager.

### Inputs
- Transcribed text from STT.
- Raw emotion signals (from prosody/text).
- Refined emotion classification (Emotion services).
- Intents & extracted facts (NLU).
- Summaries from:
  - Physical Health Engine
  - Mind & Behavior Engine
- Coaching scripts and interventions from the Coach & Planning Agent.
- Safety prompts from the Global Safety & Escalation Agent.

### Outputs
- User-facing responses (text → TTS).
- `store_candidate_memory(user_id, payload)` calls to Memory Manager.
- Internal triggers like `coach_trigger`, `safety_trigger` events.

---

## 2. Global Safety & Escalation Agent

**Type:** Rule-based + LLM agent  
**Role:** Central emergency decision-maker for CareLink.

### Responsibilities
- Subscribe to critical alerts from all engines.
- Evaluate the user’s safety profile and escalation policies.
- Attempt to contact the user via the Dialogue Orchestrator Agent.
- Decide if and when to escalate to caregivers or emergency services.
- Log all safety-related decisions for audit.

### Inputs
- `physical_alert_stream` (info/warning/critical).
- `mind_behavior_alert_stream` (info/warning/critical).
- Safety profile from Memory Manager / User Twin.
- History of past incidents.

### Outputs
- Commands to Dialogue Orchestrator Agent (“check how the user is doing”, “ask confirmation”).
- Notifications to caregivers, relatives, or services (via Notification Service).
- Logged incident reports in Logging & Audit.

---

## 3. Coach & Planning Agent

**Type:** LLM/logic agent  
**Role:** Integrated coach across all domains: physical, emotional, cognitive, social, and routine/independence.

### Responsibilities
- Periodically synthesize physical and mind/behavior state summaries.
- Consider user goals, preferences, fears, and barriers (from Memory Manager).
- Produce personalized daily/weekly coaching plans.
- Select relevant exercises and interventions from the Content & Exercise Library.
- Schedule reminders, activities, and check-ins via Scheduling Service.
- Provide scripts and prompts for Dialogue Orchestrator Agent.

### Inputs
- `get_physical_state_summary(user_id)` from Physical Health Engine.
- `get_mind_behavior_state_summary(user_id)` from Mind & Behavior Engine.
- `retrieve_for_coach(user_id)` from Memory Manager.
- Content & Exercise Library queries.

### Outputs
- Structured plans (e.g. JSON or structured objects).
- Calls to `schedule_task(...)` in Scheduling Service.
- High-level “coach alerts” when a domain needs extra attention.
- Conversation scripts/templates for Dialogue Orchestrator Agent.

---

## 4. Memory Manager (Hybrid Agent/Service)

**Type:** Hybrid (service by day, agent by night)  
**Role:** Owns CareLink’s memory about each user.

### Responsibilities
- Store and categorize candidate memories (facts, events, emotional episodes, goals).
- Provide focused memory retrieval for dialogue, coaching, and safety.
- Generate daily digests from conversation logs.
- Compress and consolidate short-term memories into long-term representations.

### Inputs
- Candidate memories from Dialogue Orchestrator Agent and other modules.
- Conversation and interaction logs.
- Metadata such as importance, type, and domain.

### Outputs
- `retrieve_for_dialogue(user_id, context)` result sets.
- `retrieve_for_coach(user_id)` structured summaries.
- `get_safety_profile(user_id)` safety-focused slice of memory.
- `daily_digest(user_id, date)` documents.
- Periodic compressed long-term memory updates.
