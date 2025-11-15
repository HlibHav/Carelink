# Memory Specification

CareLink uses **Weaviate** (vector database) + **Firestore** (metadata) to implement both:

- **Semantic memory** (RAG-style retrieval via Weaviate)
- **Structured metadata** (profiles, sessions, playbooks in Firestore)

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
  "type": "family",   // "family" | "hobby" | "health" | "routine"
  "importance": "medium",
  "metadata": {},
  "createdAt": "2025-11-14T15:20:00Z",
  "weaviateId": "uuid-reference-to-weaviate"
}
```

**Note**: Vector embeddings are stored in **Weaviate**, not Firestore. Firestore stores metadata and references.

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
  "status": "active",   // "active" | "done"
  "importance": "high",
  "metadata": {},
  "createdAt": "2025-11-14T16:00:00Z",
  "weaviateId": "uuid-reference-to-weaviate"
}
```

**Note**: Vector embeddings are stored in **Weaviate**, not Firestore.

---

### 6. `users/{userId}/gratitude/{entryId}`

Gratitude journal entries:

```json
{
  "text": "I'm grateful that I talked with my grandson today.",
  "importance": "medium",
  "metadata": {},
  "createdAt": "2025-11-14T20:30:00Z",
  "weaviateId": "uuid-reference-to-weaviate"
}
```

**Note**: Vector embeddings are stored in **Weaviate**, not Firestore.

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

CareLink uses **Weaviate** for semantic search and **Firestore** for metadata storage.

### Architecture

- **Weaviate**: Stores vector embeddings and performs semantic search
  - Collection: `Memory`
  - Vectorizer: `text2vec-openai` (text-embedding-3-small, 1536 dimensions)
  - Properties: userId, category, text, importance, factType, goalStatus, metadata, timestamps
  
- **Firestore**: Stores structured metadata
  - User profiles, conversation sessions, playbooks
  - References to Weaviate objects via `weaviateId`

### Embeddings

- Use `text-embedding-3-small` from OpenAI (via Weaviate's text2vec-openai module).
- For each new:
  - `fact`
  - `goal`
  - `gratitude` entry
- Weaviate automatically generates embeddings when storing memories.

### Retrieval (Base RAG Layer)

For each new user utterance:

1. Query Weaviate with semantic search (`nearText`).
2. Filter by `userId` and optional `category`, `factType`, `goalStatus`.
3. Weaviate returns top-k results ranked by cosine similarity.
4. Results include distance scores for ranking.
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
  - **Weaviate**: Vector embeddings for facts, goals, gratitude (semantic search)
  - **Firestore**: Metadata, profiles, sessions, playbooks (structured data)

The orchestrator uses both when constructing LLM prompts.

---

## ACE Playbooks

The Memory Manager uses **ACE (Agentic Context Engineering)** playbooks to evolve retrieval strategies and context engineering rules over time. Playbooks are stored in Firestore at `users/{userId}/playbooks/{playbookId}`.

### Playbook Structure

Playbooks contain three main sections:

1. **Retrieval Strategies**: Condition-based rules for what memories to retrieve
   - Example: "emotion=sadness AND mode=support → prioritize gratitude entries from last 7 days"
   - Each strategy has helpful/harmful scores that track effectiveness

2. **Context Engineering Rules**: Rules for filtering and prioritizing retrieved memories
   - Example: "When user mentions family, include related facts even if similarity is lower"
   - Applied after initial retrieval to refine context

3. **Common Mistakes**: Documented mistakes and their corrections
   - Prevents repetition of errors identified during reflection

### Playbook Evolution (Nightly)

The nightly agent runs an ACE cycle to evolve playbooks:

1. **Generation**: Analyzes conversation patterns to generate candidate strategies/rules
2. **Reflection**: Analyzes execution feedback to identify what went wrong/right
3. **Curation**: Incrementally updates playbooks based on reflection (prevents context collapse)

### Usage in Daytime Operations

During real-time retrieval (`/retrieve-for-dialogue`), the daytime service:

1. Loads the user's current playbook
2. Applies retrieval strategies based on current context (emotion, mode)
3. Applies context engineering rules based on query
4. Returns filtered and prioritized memories

If no playbook exists, the service falls back to default behavior (simple recency-based retrieval).

See `docs/architecture/memory-nightly-contract.md` for detailed API specifications.

