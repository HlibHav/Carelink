# CareLink API Contracts

This file defines the key contracts that Cursor and backend code should treat as canonical.

---

## 1. Memory Manager API

```ts
store_candidate_memory(userId: string, payload: MemoryPayload): MemoryId

retrieve_for_dialogue(userId: string, context: DialogueContext): MemorySnippet[]

retrieve_for_coach(userId: string): CoachMemorySummary

get_safety_profile(userId: string): SafetyProfile

daily_digest(userId: string, date: string): DailyDigest

compress_short_to_long_term(userId: string, period: string): void
```

---

## 2. Physical Health Engine API

```ts
get_physical_state_summary(userId: string): PhysicalStateSummary

get_trends(userId: string, metric: PhysicalMetric, window: TimeWindow): TrendSeries

// Event stream (e.g. via message bus)
physical_alert_stream: PhysicalAlertEvent
```

---

## 3. Mind & Behavior Engine API

```ts
get_mind_behavior_state_summary(userId: string): MindBehaviorStateSummary

// Optional extended endpoints
get_mood_trend(userId: string, window: TimeWindow): TrendSeries
get_cognitive_history(userId: string, window: TimeWindow): TrendSeries
get_social_pattern(userId: string, window: TimeWindow): SocialPattern
get_routine_adherence(userId: string, window: TimeWindow): RoutineAdherence

// Event stream
mind_behavior_alert_stream: MindBehaviorAlertEvent
```

---

## 4. Scheduling & Notification API

```ts
schedule_task(userId: string, time: Date, payload: ScheduledPayload): TaskId

cancel_task(taskId: string): void

send_notification(channel: NotificationChannel, payload: NotificationPayload): void
```

---

## 5. Behavioral Rules Summary

- Agents **never** compute raw metrics or read sensors directly.
- Engines **never** talk to the user or make final decisions.
- Skills **never** exist as standalone microservices.
- Services **never** orchestrate multi-step behavior; they are utilities only.
