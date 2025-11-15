# CareLink — Unambiguous Architecture Specification (Cursor-Ready)

This document defines **clear, precise, implementation-ready specifications** for all entities within the CareLink.  
It is designed to be used as **context for Cursor**, ensuring *no ambiguity* between agents, engines, skills, or services.

---

# 1. DEFINITIONS: CORE CONCEPTS

To avoid ambiguity, the system separates components into four distinct categories:

1. **Agents** — Autonomous LLM-driven decision-makers.  
2. **Engines** — Deterministic domain analytics modules (non-LLM).  
3. **Skills** — Sub-capabilities inside engines or agents (not standalone modules).  
4. **Services** — Infrastructure utilities (APIs, storage, scheduling, permissions).

Each category is explicitly defined below.

---

# 2. AGENTS (Autonomous LLM-Driven Components)

Agents perform **reasoning**, **decision-making**, **interpretation**, and **user-facing communication**.  
Agents **consume Engine outputs** and **use Services**, but do *not* perform analytics or metric calculations themselves.

All agents are pure decision/orchestration layers.

---

## 2.1 Dialogue Orchestrator Agent

### **Role**
The **single conversational interface** for the system. Mediates all interactions between the user and internal modules.

### **Responsibilities**
- Convert user STT text into structured intents/facts/emotions.
- Retrieve relevant memories.
- Retrieve physical/mind state from engines.
- Adapt tone and generate empathetic, context-aware responses.
- Trigger other agents (Coach / Safety) when required.
- Submit new facts/events to Memory Manager.

### **Inputs**
- STT text  
- Raw emotion signals  
- Refined emotion classification  
- Intents & extracted facts  
- Summaries from:
  - Physical Health Engine  
  - Mind & Behavior Engine  
- Interventions/scripts from Coach Agent  
- Safety prompts (“Check user status”)

### **Outputs**
- Text/voice responses  
- `store_candidate_memory` calls  
- `coach_trigger` or `safety_trigger` internal events  

---

## 2.2 Global Safety & Escalation Agent

### **Role**
The single **central emergency decision maker**.

### **Responsibilities**
- Listen to all critical alerts from engines.
- Check the user’s safety profile and permissions.
- Contact the user via Dialogue Agent.
- Decide escalation to caregivers or emergency services.
- Log all safety decisions for audit.

### **Inputs**
- Alert streams:
  - `physical_alert_stream`
  - `mind_behavior_alert_stream`
- Safety profile (Memory Manager + User Twin)
- Interaction history (Memory Manager)

### **Outputs**
- Commands to Dialogue Agent
- Emergency notifications
- Logged incident reports

---

## 2.3 Coach & Planning Agent

### **Role**
A **multi-domain long-term planning agent** responsible for:
physical, emotional, cognitive, social, and routine-based interventions.

### **Responsibilities**
- Synthesize engine outputs.
- Retrieve goals, preferences, barriers from memory.
- Generate daily/weekly personalized care plans.
- Provide scripts, exercises, and behavioral nudges to Dialogue Agent.
- Populate Scheduling Service.

### **Inputs**
- Physical state summaries
- Mind & Behavior state summaries
- Goals, motivations, history (Memory Manager)
- Content Library items

### **Outputs**
- Structured plans
- Scheduled tasks
- Scripts/templates for Dialogue Agent

---

## 2.4 Memory Manager (Hybrid Agent/Service)

### **Dual Mode**
- **Day = service:** provides deterministic memory read/write.
- **Night = agent:** performs autonomous summarization, compression, consolidation.

### **Responsibilities**
- Store candidate memories.
- Retrieve relevant memories for dialogue, coaching, safety.
- Generate daily conversation digests.
- Compress short-term to long-term memory.

### **Inputs**
- Candidate memories
- Conversation logs
- Metadata (importance, type)

### **Outputs**
- Structured user memories
- Safety profile
- Daily digests
- Retrieval APIs

---

# 3. ENGINES (Deterministic Analytics Modules)

**Engines are NOT agents and cannot make autonomous decisions.**  
They process structured data, compute metrics, detect anomalies, and produce summaries & alert events.

---

## 3.1 Physical Health Engine

### **Role**
Analytics engine for all **physiological and sensor-derived signals**.

### **Data Sources**
- HR  
- HRV  
- SpO₂  
- Respiratory Rate  
- Body Temperature  
- Steps / mobility  
- Sleep architecture  
- Falls / sudden movement anomalies

### **Outputs**
- `get_physical_state_summary(user_id)`
- `get_trends(user_id, metric, window)`
- `physical_alert_stream` (info/warning/critical)

### **Prohibited behavior**
- No decisions  
- No messaging  
- No interaction with user

---

## 3.2 Mind & Behavior Engine (Unified)

This engine consolidates four previously separate modules.

### **Role**
Analyze user’s **emotion, cognition, social connectedness, routine adherence, and independence**.

### **Internal Skills**
1. **Emotional State Skill**  
2. **Cognitive Skill**  
3. **Social Connectedness Skill**  
4. **Routine/Self-Care Skill**

### **Outputs**
- `get_mind_behavior_state_summary(user_id)`
- `mind_behavior_alert_stream` (info/warning/critical)
- Optional detailed endpoints:
  - `get_mood_trend`
  - `get_cognitive_history`
  - `get_social_pattern`
  - `get_routine_adherence`

### **Prohibited behavior**
- No decisions  
- No actions  
- No user messaging  

---

# 4. SKILLS (Submodules inside Engines or Agents)

A **skill is not a standalone service**.  
It is compute logic that belongs strictly to either an Engine or an Agent.

### Examples:
- Emotion classification skill (Dialogue + Mind Engine)
- Cognitive assessment skill (Mind Engine)
- Tone adaptation skill (Dialogue Agent)
- Physical risk scoring skill (Physical Engine)
- Social connectedness metric skill (Mind Engine)

Skills = “functions”, not modules.

---

# 5. SERVICES (Infrastructure & APIs)

Services are deterministic, stateless or stateful utilities used by Agents & Engines.

---

## 5.1 Language & Interaction Services
- **STT Service**
- **TTS Service**
- **NLU/Intent Extractor**
- **Raw Emotion Analyzer**
- **Refined Emotion Classifier**
- **Tone Selector**

---

## 5.2 Memory & User Modeling Services
- **Memory Store** (vector DB + structured DB)
- **User Twin Store**
- **Memory Manager API Layer**

---

## 5.3 System Infrastructure Services
- **Event Bus**
- **Scheduling & Notification Service**
- **Permissions & Privacy Service**
- **Logging & Audit**
- **Content & Exercise Library**
- **Reporting & Dashboards**

---

# 6. OFFICIAL INTERFACES (Unambiguous API Contract)

## 6.1 Memory Manager API
```
store_candidate_memory(user_id, payload)
retrieve_for_dialogue(user_id, context)
retrieve_for_coach(user_id)
get_safety_profile(user_id)
daily_digest(user_id, date)
compress_short_to_long_term(user_id, period)
```

## 6.2 Physical Engine API
```
get_physical_state_summary(user_id)
get_trends(user_id, metric, window)
physical_alert_stream (event)
```

## 6.3 Mind & Behavior Engine API
```
get_mind_behavior_state_summary(user_id)
mind_behavior_alert_stream (event)
(optional detailed APIs)
```

## 6.4 Scheduling API
```
schedule_task(user_id, time, payload)
cancel_task(task_id)
send_notification(channel, payload)
```

---

# 7. BEHAVIORAL RULES (Preventing Ambiguity)

### Agents:
- **Agents never compute metrics.**  
- **Agents never read sensors directly.**

### Engines:
- **Engines never talk to the user.**  
- **Engines do not make judgments or plans.**

### Skills:
- **Skills cannot exist outside their parent module.**

### Services:
- **Services are passive.**  
- **Services do not orchestrate logic.**

---

# 8. COMPLETE SYSTEM RESPONSIBILITY MAP

| Component | Computation | Reasoning | Decisions | User Interaction |
|-----------|-------------|-----------|-----------|------------------|
| Physical Engine | YES | NO | NO | NO |
| Mind & Behavior Engine | YES | NO | NO | NO |
| Dialogue Agent | NO | YES | Partial | YES |
| Coach Agent | NO | YES | YES (non-emergency) | Indirect (via Dialogue) |
| Safety Agent | NO | YES | YES (emergency) | Indirect (via Dialogue) |
| Memory Manager | Partial (summaries) | YES (only at night) | NO | NO |
| Services | Deterministic only | NO | NO | NO |

---

# 9. IMPLEMENTATION NOTES FOR CURSOR

When building this system:

- Treat **Agents as orchestrators**.  
- Treat **Engines as pure analytics**.  
- Treat **Skills as internal utility functions**.  
- Treat **Services as outside-world APIs**.

No component should duplicate responsibilities.

This spec defines the canonical, unambiguous contract for all system components.

