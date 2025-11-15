# CareLink Repository Layout & Event Contracts

This document captures the target monorepo structure and the canonical contracts that tie all runtime components together.  
Everything here mirrors the architecture outlined in `docs/architecture/carelink_system_spec_cursor_ready.md`.

## 1. Directory Layout

```
Carelink/
├─ agents/
│  ├─ dialogue/            # Turn-by-turn orchestrator, tone selector, memory writes
│  ├─ coach/               # Long-horizon planning, scheduling, script generation
│  ├─ safety/              # Alert routing, escalation policy, caregiver comms
│  └─ memory-nightly/      # Night agent for memory compression/digests
├─ engines/
│  ├─ physical/            # Deterministic vitals + mobility analytics + alerts
│  └─ mind-behavior/       # Emotion, cognition, social, routine analytics
├─ services/
│  ├─ memory-manager/      # API layer in front of Memory Store + User Twin
│  ├─ language/            # STT, TTS, NLU, tone selector utilities
│  ├─ event-bus/           # Kafka/PubSub plumbing for alert & agent triggers
│  ├─ scheduling/          # Reminders + caregiver notifications
│  └─ reporting/           # Dashboards, caregiver reports, audit feeds
├─ apps/
│  ├─ gateway/             # Public HTTP API that authenticates clients and fans out
│  ├─ user-client/         # Voice-first UI for the older adult (Vite/React)
│  └─ caregiver-console/   # Operational dashboard / triage tools
└─ docs/, prompts/, scripts/, etc.
```

## 2. Event Bus Contracts

All asynchronous flows use a shared Event Bus (Kafka/Pub/Sub). Events are versioned, immutable, and follow JSON schema.

### 2.1 Engine Alert Streams

`physical.alert.v1`
```json
{
  "event_id": "evt_123",
  "user_id": "user_42",
  "severity": "info | warning | critical",
  "source": "heart_rate | hrv | spo2 | respiration | temperature | mobility | sleep | fall",
  "observed_at": "2024-03-12T14:03:11Z",
  "metrics": {
    "value": 102,
    "baseline": 82,
    "unit": "bpm"
  },
  "notes": "HR exceeded personalized threshold for >10m"
}
```

`mind_behavior.alert.v1`
```json
{
  "event_id": "evt_987",
  "user_id": "user_42",
  "domain": "emotional | cognitive | social | self_care",
  "severity": "info | warning | critical",
  "observed_at": "2024-03-12T15:01:08Z",
  "signals": {
    "score": 0.28,
    "trend": "declining",
    "window_days": 7
  },
  "notes": "Conversation data indicates rising loneliness"
}
```

### 2.2 Agent Coordination Events

`coach.trigger.v1`
```json
{
  "event_id": "evt_ct_22",
  "user_id": "user_42",
  "reason": "Goal open loop | Routine drop-off | Alert follow-up",
  "requested_mode": "support | coach | gratitude | reminder | game",
  "context_turn_id": "turn_abc",
  "metadata": {
    "goal_id": "goal_001",
    "due_at": "2024-03-13T09:00:00-05:00"
  }
}
```

`safety.trigger.v1`
```json
{
  "event_id": "evt_st_45",
  "user_id": "user_42",
  "source_event": "physical.alert.v1 | mind_behavior.alert.v1",
  "status": "pending | acknowledged | escalated | resolved",
  "policy": "fall_critical | sos_button | prolonged_silence",
  "notes": "Mind engine flagged persistent low mood, request proactive check-in"
}
```

### 2.3 Memory Manager Events

`memory.candidate.v1`
```json
{
  "event_id": "evt_mem_77",
  "user_id": "user_42",
  "turn_id": "turn_xyz",
  "category": "fact | goal | gratitude | safety | routine",
  "importance": "low | medium | high",
  "text": "User walks everyday at 3pm with neighbor Sara"
}
```

`memory.digest.ready.v1`
```json
{
  "event_id": "evt_memdig_12",
  "user_id": "user_42",
  "date": "2024-03-12",
  "summary_path": "gs://carelink-digests/user_42/20240312.json"
}
```

## 3. HTTP Contracts Snapshot

| Service | Endpoint | Description |
| --- | --- | --- |
| Physical Engine | `GET /state/:userId` | Deterministic vitals summary |
| Physical Engine | `GET /trends/:userId/:metric?window=7d` | Time-window aggregates |
| Mind & Behavior Engine | `GET /state/:userId` | Emotional, cognitive, social, self-care state |
| Memory Manager | `POST /memory/:userId/retrieve-for-dialogue` | Focused recall for Dialogue Agent |
| Memory Manager | `POST /memory/:userId/store-candidate` | Store candidate memory |
| Memory Manager | `POST /memory/:userId/turns` | Persist conversation turn |

The `apps/gateway` service is now a thin authenticated façade that forwards user interactions to these services and publishes/consumes the event contracts listed above.
