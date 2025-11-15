# CareLink Engines Specification

CareLink uses two deterministic analytics engines:

1. **Physical Health Engine**
2. **Mind & Behavior Engine**

> **Implementation note**: The current repository contains stub implementations of both engines that generate deterministic mock data. They expose the interfaces described below so the rest of the platform can evolve independently while real ingestion pipelines are being built.

Engines **do not** interact with users directly and **do not** make autonomous decisions.
They compute metrics, trends, risks, and anomalies.

---

## 1. Physical Health Engine

### Role
Analytics engine for physiological and sensor-derived data.

### Data Sources (examples)
- Heart Rate (HR)
- Heart Rate Variability (HRV)
- Blood oxygen saturation (SpO₂)
- Respiratory Rate (RR)
- Body Temperature
- Steps / activity / posture
- Sleep: duration, stages, awakenings
- Falls / balance incidents

### Responsibilities
- Normalize data from different wearable APIs (HealthKit, Google Fit, vendor APIs).
- Maintain user-specific baselines and distributions.
- Compute time-windowed aggregates and trends.
- Detect anomalies and generate alerts.

### Core APIs
- `get_physical_state_summary(user_id)`
  - Returns: current status, trends, risk scores, recommended high-level actions.
- `get_trends(user_id, metric, window)`
  - Returns: time series aggregates for the metric.
- `physical_alert_stream` (event channel)
  - Events: info, warning, critical (e.g., fall events, dangerous HR/SpO₂, persistent fever).

---

## 2. Mind & Behavior Engine (Unified)

### Role
Unified engine that covers:
- Emotional state
- Cognitive function
- Social connectedness / loneliness
- Routine adherence & self-care / independence

### Internal Skills

These are skills **inside** the engine (not separate modules):

1. **Emotional State Skill**
   - Uses sentiment/emotion analysis, mood check-ins, and patterns from conversations.
2. **Cognitive Skill**
   - Uses cognitive tests and tasks, performance trends, error patterns.
3. **Social Connectedness Skill**
   - Uses call/message frequency, contact graph, interaction with the companion, self-reported loneliness.
4. **Routine & Self-Care Skill**
   - Uses adherence to medication reminders, hygiene routines, sleep/wake times, daily activity structure.

### Responsibilities
- Compute a consistent, multi-dimensional view of the user’s mind & behavior.
- Track trends for mood, cognition, social connectedness, and independence.
- Raise alerts when thresholds or risk patterns are detected.

### Core APIs
- `get_mind_behavior_state_summary(user_id)`
  - Returns a unified summary:
    - `emotional_state`
    - `cognitive_state`
    - `social_connectedness`
    - `self_care_independence`
    - plus trends and risk descriptors.
- `mind_behavior_alert_stream` (event channel)
  - Events categorized by domain:
    - emotional, cognitive, social, self_care
    - levels: info, warning, critical

### Prohibited Behavior
- The engine must not:
  - talk to the user,
  - decide on plans,
  - trigger escalation directly (it only emits alerts).
