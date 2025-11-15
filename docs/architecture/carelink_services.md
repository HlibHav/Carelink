# CareLink Services Specification

Services are deterministic utilities that support Agents and Engines.
They do not perform high-level reasoning or user-facing orchestration.

---

## 1. Language & Interaction Services

### 1.1 STT Service
- Function: Speech → text.
- Used by: Dialogue Orchestrator Agent.

### 1.2 TTS Service
- Function: Text → speech.
- Used by: Dialogue Orchestrator Agent.

### 1.3 NLU / Intent & Fact Extractor
- Function: Extract intents, slots, and structured facts from text.
- Used by: Dialogue Orchestrator Agent, optionally Mind & Behavior Engine.

### 1.4 Raw Emotion Analyzer
- Function: Initial emotion detection from prosody and/or text.
- Used by: Dialogue Orchestrator Agent, Mind & Behavior Engine.

### 1.5 Refined Emotion Classifier
- Function: Combine raw emotion, context, and recent history into a refined emotional state.
- Used by: Dialogue Orchestrator Agent, Mind & Behavior Engine.

### 1.6 Tone Selector
- Function: Choose response tone parameters (formality, directness, humour, warmth).
- Used by: Dialogue Orchestrator Agent.

---

## 2. Memory & User Modeling Services

### 2.1 Memory Store
- Backend storage for Memory Manager:
  - Vector DB (semantic recall).
  - Structured DB (facts, profiles, safety records, goals).

### 2.2 User Twin Store
- Structured, queryable user model:
  - demographics, preferences, diagnoses (if allowed), emergency contacts, permissions, goals.

### 2.3 Memory Manager API Layer
- Provides:
  - `store_candidate_memory(...)`
  - `retrieve_for_dialogue(...)`
  - `retrieve_for_coach(...)`
  - `get_safety_profile(...)`
  - `daily_digest(...)`
  - `compress_short_to_long_term(...)`

---

## 3. System Infrastructure Services

### 3.1 Event Bus
- Node/Express service that exposes `POST /events` and `GET /events/stream/:topic`.
- Maintains an in-memory backlog per topic so that reconnecting agents can replay missed events via `?lastEventId=<id>`.
- Hosts all cross-agent contracts used today: `coach.trigger.v1`, `coach.plan.ready.v1`, `safety.trigger.v1`, `safety.command.v1`, `safety.command.handled.v1`, `physical.alert.v1`, `mind_behavior.alert.v1`.

### 3.2 Scheduling & Notification Service
- Stub service with the following endpoints:
  - `POST /schedule-task` — store a reminder payload.
  - `POST /cancel-task` — mark a reminder as cancelled.
  - `POST /send-notification` — echo the payload (used by Coach/Safety agents for caregiver/emergency pings).
- Stores data in-memory for now; restarting the service resets the queue.

### 3.3 Permissions & Privacy Service
- Central policy engine for who can see what data.
- Used heavily by Safety Agent, Coach Agent, Reporting.

### 3.4 Logging & Audit Service
- Not implemented as a standalone service yet. Safety and Coach agents log incidents back into the Memory Manager collections so they can be audited until a dedicated service is added.

### 3.5 Content & Exercise Library
- Repository of:
  - physical exercises,
  - cognitive tasks,
  - mental health practices,
  - social activities,
  - conversational scripts.

### 3.6 Reporting & Dashboards
- Generates:
  - clinician-friendly reports,
  - caregiver summaries,
  - trend dashboards.
