# Memory Specification

LifeCompanion uses **Firestore** + **OpenAI embeddings** to implement both:

- **Structured memory** (facts, goals, gratitude, mood)
- **Semantic memory** (RAG-style retrieval)

---

## Firestore Collections (Minimal Schema)

### 1. `users/{userId}`

Root user document:

```json
{
  "displayName": "Maria",
  "ageRange": "65-75",
  "livesAlone": true,
  "personalitySummary": "Introverted, high agreeableness, moderate neuroticism",
  "createdAt": "2025-11-14T15:00:00Z"
}
```

### 2. `users/{userId}/profile`

Structured psychological and preference data:

```json
{
  "bigFive": {
    "extraversion": "low",
    "agreeableness": "high",
    "neuroticism": "medium",
    "conscientiousness": "medium",
    "openness": "high"
  },
  "preferences": {
    "pace": "slow",
    "likesHumor": true,
    "topicsToAvoid": ["war", "politics"],
    "favoriteTopics": ["gardening", "grandchildren"],
    "tone": "warm_slow"
  },
  "healthBaseline": {
    "mobility": "moderate",
    "sleepPattern": "variable",
    "notes": "Sometimes feels lonely at night"
  }
}
```

### 3. `users/{userId}/conversations/{sessionId}`

Session metadata:

```json
{
  "startedAt": "2025-11-14T15:15:00Z",
  "lastEmotion": {
    "primary": "sadness",
    "intensity": "medium",
    "energy": "low"
  },
  "lastMode": "support"
}
```

#### 3.1 `users/{userId}/conversations/{sessionId}/turns/{turnId}`

Individual conversation turns:

```json
{
  "role": "user" | "assistant",
  "text": "string",
  "emotion": {
    "primary": "sadness",
    "intensity": "medium",
    "energy": "low"
  },
  "createdAt": "2025-11-14T15:16:02Z"
}
```

---

### 4. `users/{userId}/facts/{factId}`

Life facts and routines extracted from conversations:

```json
{
  "text": "My sister Olya lives in Lviv.",
  "embedding": [0.0123, -0.0456, ...],
  "type": "family",   // "family" | "hobby" | "health" | "routine"
  "createdAt": "2025-11-14T15:20:00Z"
}
```

**Extraction rules:**
- Only written when Listener/Memory Agent confidently identifies a stable fact
- Use pattern detection ("sounds like a fact") and/or explicit user confirmation
- Types: `family`, `hobby`, `health`, `routine`

---

### 5. `users/{userId}/goals/{goalId}`

User goals and habits:

```json
{
  "text": "I want to go for a walk at least three times a week.",
  "embedding": [0.01, 0.03, ...],
  "status": "active",   // "active" | "done"
  "createdAt": "2025-11-14T16:00:00Z"
}
```

---

### 6. `users/{userId}/gratitude/{entryId}`

Gratitude journal entries:

```json
{
  "text": "I'm grateful that I talked with my grandson today.",
  "embedding": [0.02, -0.03, ...],
  "createdAt": "2025-11-14T20:30:00Z"
}
```

---

### 7. `users/{userId}/mood_snapshots/{day}`

Daily mood aggregates (day format: "YYYY-MM-DD"):

```json
{
  "avgMood": -0.2,   // numeric score where 0 = neutral
  "notes": "Felt lonely in the evening but had a nice call with friend."
}
```

---

## Semantic RAG Design

We keep RAG **simple** and **local** to Firestore.

### Embeddings

- Use `text-embedding-3-small` from OpenAI.
- For each new:
  - `fact`
  - `goal`
  - `gratitude` entry
- We compute an embedding and store it directly in Firestore as an array of floats.

### Retrieval (Base RAG Layer)

For each new user utterance:

1. Compute its embedding.
2. Load last N documents (e.g., 200) from:
   - `facts`
   - `goals`
   - `gratitude`
3. Compute cosine similarity in memory (TypeScript):
   ```ts
   function cosineSimilarity(a: number[], b: number[]): number { ... }
   ```
4. Rank by similarity.
5. Take top-k (e.g. 10–20) per category as **candidates**.

**Note**: These raw RAG results are then passed to **Context Engineering Agent** for intelligent curation (see below).

---

## Agentic Context Engineering

**Why Agentic vs Simple RAG?**

Simple RAG returns top-k by semantic similarity, but doesn't consider:
- **Emotional state**: Sad user needs different context than happy user
- **Conversation mode**: Coach mode needs goals, Support mode needs empathy
- **User preferences**: Topics to avoid, favorite topics
- **Temporal relevance**: Open loops (medications, appointments), recent events
- **Relationship dynamics**: Trust level, last positive moment

### Context Engineering Agent Process

1. **Receives raw RAG results** (top 10–20 candidates per category)
2. **Receives context signals**:
   - Emotion state (sad/joy/anxious, intensity, energy)
   - Current mode (support/coach/gratitude/game/reminder)
   - User profile (preferences, psychological portrait)
   - Health snapshot (sleep, steps, heart rate)
   - Open loops (medications, appointments, goals)
   - Relationship context (trust level, last positive moment)

3. **LLM-based filtering & prioritization**:
   - **Emotional filtering**: When user is sad → prioritize support memories, filter out triggering topics
   - **Mode-based selection**: 
     - Coach mode → active goals, recent progress
     - Support mode → recent gratitude, positive memories
     - Gratitude mode → past gratitude entries, positive patterns
   - **Preference respect**: Filters out topics user wants to avoid
   - **Open loop prioritization**: Medications and appointments get higher priority
   - **Temporal relevance**: Recent events weighted higher than old ones
   - **Relationship awareness**: Trust level affects what to mention (low trust → less personal)

4. **Forms curated context snapshot**:
   ```ts
   {
     current_mood: "...",
     health_snapshot: "...",
     today: { sleep: 5.5, steps: 1200 },
     open_loops: [
       { type: "medication", priority: "high", text: "remind_to_take_blood_pressure_pills" },
       { type: "appointment", priority: "medium", text: "ask_about_upcoming_doctor_visit" }
     ],
     relationship: {
       trust_level: "growing",
       last_positive_moment: "yesterday's story about granddaughter"
     },
     selected_memories: {
       facts: [...], // filtered & ranked by relevance
       goals: [...], // only active, relevant ones
       gratitude: [...] // recent, emotionally relevant
     },
     context_for_planner: "...", // structured summary for Planner Agent
     context_for_coach: "..." // different structure for Coach Agent
   }
   ```

### Benefits

- **Avoids overwhelming LLM** with irrelevant context
- **Adapts to emotional state** and conversation mode
- **Respects user preferences** (topics to avoid)
- **Prioritizes what matters NOW** (open loops, recent events)
- **Reduces hallucinations** by being selective
- **Different context structures** for Planner vs Coach Agent

### Avoiding Hallucinations

- The Context Engineering Agent only selects from what's actually stored
- The system prompt makes it very clear:
  - Only use these memories if they are present in the curated list
  - If unsure, ask the user instead of assuming
  - Do not "remember" something the user never said
- Agentic filtering adds an extra layer of validation

---

## Short-Term vs Long-Term Memory

- **Short-term**:
  - Last 5–10 turns in the current session (kept in backend memory).
- **Long-term**:
  - Firestore collections for facts, goals, gratitude, mood.

The orchestrator uses both when constructing LLM prompts.

