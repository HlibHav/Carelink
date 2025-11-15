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
- Asynchronous event transport for:
  - alert streams from engines,
  - internal triggers between agents.

### 3.2 Scheduling & Notification Service
- Schedule tasks/reminders.
- Send notifications across channels (push, SMS, calls, etc.).

### 3.3 Permissions & Privacy Service
- Central policy engine for who can see what data.
- Used heavily by Safety Agent, Coach Agent, Reporting.

### 3.4 Logging & Audit Service
- Stores:
  - safety decisions,
  - escalations,
  - access logs,
  - plan changes.

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
