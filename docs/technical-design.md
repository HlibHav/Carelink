# Technical Design

## Tech Stack

- **Backend**
  - Language: **TypeScript**
  - Runtime: **Node.js (LTS)**
  - Web framework: **Tailwind**
  - Deployment: **Google Cloud Run**
  - Package manager:`npm`

- **Frontend**
  - Minimal React or plain HTML/JS (depends on time)
  - Features:
    - Mic capture (Web Audio + MediaRecorder)
    - Send audio blobs to backend
    - Play back audio responses

- **Database**
  - **Weaviate**: Vector database for semantic memory search
  - **Firestore (Native mode)**: Metadata storage (profiles, sessions, playbooks)

- **AI / ML**
  - **OpenAI**:
    - `gpt-4.1` or `gpt-4.1-mini` for LLM calls
    - `gpt-4o-mini` or `gpt-4.1-mini` for emotion/mode/aux tasks
    - `whisper-1` for speech-to-text
    - `text-embedding-3-small` for embeddings (via Weaviate's text2vec-openai module)
  - **ElevenLabs**:
    - `text-to-speech` endpoint with a single voice
  - **Langchain / Langgraph**:
    - Orchestration framework for multi-agent flow
    - Listener + Emotion detection
    - Memory update
    - Planner / Coach decision
    - Tone selection
    - Response generation
    - (Optional) Game / Reminder / Health-check

- **Observability**
  - **Phoenix (Arize Phoenix)**:
    - HTTP-based logging of traces
    - Later: integrated evals

---

## Backend Modules

> **Note**: For extensible agent architecture and tools system, see `agents-and-tools.md`

## Backend Modules

### 1. `server.ts`

- Exposes routes:
  - `POST /api/start-conversation`
  - `POST /api/user-utterance`
  - `GET  /api/session-summary?userId=...`
- Sets up:
  - JSON parsing
  - CORS
  - Health check endpoint (`GET /healthz`)

#### Authentication & Common Headers

- Clients obtain a short-lived access token from the identity layer (out of scope here) and attach it as `Authorization: Bearer <token>`.
- Every request also carries:
  - `X-User-Id`: stable Firestore user id.
  - `X-Device-Id`: client-generated identifier used to correlate proactive pings.
  - `X-Client-Version`: semantic version for compatibility checks.
- If auth fails or the token is missing → `401` with the standard error envelope described below.

#### Error Envelope

All non-2xx responses return:

```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No active session d9f3a7 for user u_123",
    "retryable": false,
    "details": {
      "sessionId": "d9f3a7"
    }
  }
}
```

- `code` is a machine readable string (see table below).
- `retryable` lets the client decide whether to re-issue the call automatically.
- Typical codes: `INVALID_AUTH`, `SESSION_NOT_FOUND`, `AUDIO_TOO_LONG`, `THROTTLED`, `LLM_TIMEOUT`, `INTERNAL_ERROR`.

#### REST Contracts

##### `POST /api/start-conversation`

Purpose: create (or resume) a conversational session and return the transport endpoints the client should use.

Request:

```json
{
  "locale": "uk-UA",
  "capabilities": {
    "audioFormat": "audio/webm;codecs=opus",
    "supportsText": true,
    "wantsProactiveGreeting": true
  },
  "context": {
    "timezone": "Europe/Kyiv",
    "entryPoint": "daily_ritual"
  }
}
```

Response `201`:

```json
{
  "sessionId": "sess_d9f3a7",
  "expiresAt": "2025-02-15T10:30:00Z",
  "websocketUrl": "wss://api.lifecompanion.app/ws/conversation?sess=sess_d9f3a7",
  "uploadUrl": "https://api.lifecompanion.app/api/user-utterance",
  "shouldAgentSpeakFirst": true,
  "initialPromptToken": "turn_a1b2",
  "iceBreakers": [
    "How did you sleep?",
    "What would feel supportive today?"
  ]
}
```

Errors:
- `409` `SESSION_ALREADY_ACTIVE` if a device tries to open a second active session.
- `422` `UNSUPPORTED_CAPABILITY` if the requested audio format is unknown.

##### `POST /api/user-utterance`

Purpose: send a new turn (audio or text) to the orchestrator.

- Headers:
  - `Content-Type: multipart/form-data` (preferred) or `application/json` when sending text only.
  - `X-Session-Id`: session obtained from `start-conversation`.
- Payload (multipart example):
  - `audio` (binary) — encoded as `audio/webm` or `audio/wav`.
  - `transcript` (optional string) — pre-transcribed text when client already ran STT.
  - `metadata` (JSON string) — `{ "durationMs": 5400, "sampleRate": 48000 }`.

Response `202`:

```json
{
  "turnId": "turn_a1b2",
  "sessionId": "sess_d9f3a7",
  "stream": {
    "websocket": "wss://api.lifecompanion.app/ws/conversation?sess=sess_d9f3a7",
    "sse": "https://api.lifecompanion.app/api/turn-stream?turn=turn_a1b2"
  },
  "estimatedProcessingMs": 4500
}
```

- The server processes the audio asynchronously and emits progress over the WebSocket/SSE stream (see below).
- Errors:
  - `413` `AUDIO_TOO_LONG` (>40 s or >10 MB).
  - `429` `THROTTLED` when user sends overlapping turns.

##### `GET /api/session-summary?sessionId=...`

Purpose: fetch condensed information for UI cards.

Response `200`:

```json
{
  "sessionId": "sess_d9f3a7",
  "userId": "u_123",
  "startedAt": "2025-02-15T10:05:00Z",
  "endedAt": "2025-02-15T10:22:00Z",
  "moodTrend": "improving",
  "bullets": [
    "Felt calmer after the breathing reminder.",
    "Committed to a 5-minute walk after lunch."
  ],
  "capturedGoals": [
    { "goalId": "goal_901", "text": "Walk after lunch", "status": "active" }
  ],
  "gratitudeEntries": [
    { "entryId": "grat_44", "text": "Granddaughter called" }
  ]
}
```

Errors:
- `404` `SESSION_NOT_FOUND`
- `403` if user tries to read someone else’s session.

#### WebSocket / Streaming Contract

- Endpoint: `wss://api.lifecompanion.app/ws/conversation`.
- Client connects with query params `sess`, `device`, and the same bearer token; the server rejects if the session expired.
- Messages are JSON envelopes:

```json
{
  "type": "status|transcript|emotion|coach_reply|tts_chunk|error",
  "turnId": "turn_a1b2",
  "timestamp": "2025-02-15T10:12:05.230Z",
  "payload": { "...": "..." }
}
```

Key payload shapes:
- `status`: `{ "stage": "processing|speaking|complete" }`
- `transcript`: `{ "partial": true, "text": "я думаю..." }`
- `emotion`: matches the schema in `ai-architecture.md` (primary, intensity, energy, social_need).
- `coach_reply`: `{ "text": "..." , "actions": [...] }`
- `tts_chunk`: `{ "sequence": 3, "audioBase64": "..." }`
- `error`: wraps the same `error` object as REST responses.

When the server needs to proactively start a conversation (e.g., rituals), it pushes a `status` message with `stage: "proactive_prompt"` and an accompanying `coach_reply`, prompting the client to auto-play or surface UI per the user’s preferences.

### 2. `orchestrator/ConversationOrchestrator.ts`

**Orchestrator decides "what to do next"**

Responsible for the core flow, implemented with Langchain/Langgraph pattern:

```ts
async function handleUserUtterance(input: {
  userId: string;
  audioBuffer: Buffer;
  sessionId: string;
}): Promise<{ audioReply: Buffer; textReply: string; debug?: any }> {
  // 1. Listener Agent: STT + extract facts/intentions/emotions
  const listenerResult = await listenerAgent.process(input.audioBuffer);
  const { transcript, facts, intentions, emotions } = listenerResult;

  // 2. Emotion classification (refined from listener)
  const emotionState = await emotionAgent.classify(transcript, listenerResult);

  // 3. Memory Manager: Base RAG retrieval
  const rawMemories = await memoryService.getRelevantContext(input.userId, transcript);
  
  // 4. Context Engineering Agent: Intelligent curation
  const context = await contextEngineeringAgent.curate({
    rawMemories,
    emotionState,
    userProfile: await memoryAgent.getProfile(input.userId),
    healthSnapshot: await healthService.getSnapshot(input.userId),
    lastMode: await memoryAgent.getLastMode(input.userId),
  });
  // Returns: curated context snapshot with filtered & prioritized memories

  // 5. Planner/Coach Agent: Decide mode & goal
  const modeDecision = await plannerAgent.plan({
    lastEmotion: context.lastEmotion,
    lastMode: context.lastMode,
    emotionState,
    userProfile: context.userProfile,
    openLoops: context.openLoops,
  });
  // Output: { mode, goal }

  // 6. Generate reply (coach/companion)
  const { replyText, coachingActions } = await coachAgent.reply({
    transcript,
    emotionState,
    mode: modeDecision.mode,
    goal: modeDecision.goal,
    userProfile: context.userProfile,
    memories: context.relevantMemories,
    contextSnapshot: context.snapshot, // curated context
  });

  // 7. Tone selection
  const tone = toneAgent.select({
    emotionState,
    mode: modeDecision.mode,
    coachIntensity: modeDecision.coachIntensity,
    userProfile: context.userProfile,
  });

  // 8. TTS with ElevenLabs
  const audioReply = await ttsService.speak(replyText, tone);

  // 9. Memory Agent: Persist conversation + extract new facts/goals
  await memoryAgent.persistTurn({
    userId: input.userId,
    sessionId: input.sessionId,
    transcript,
    replyText,
    emotionState,
    modeDecision,
    coachingActions,
    extractedFacts: listenerResult.facts,
  });

  // 10. Log to Phoenix
  await observability.logTurn({ ... });

  return { audioReply, textReply: replyText };
}
```

**Orchestrator Input:**
- `last_emotion` (sad/joy/anxious, intensity, energy)
- `user_profile` (psychological portrait)
- `open_loops` (plans/promises/goals)
- `last_mode` (small_talk/coach/game/gratitude/reminder)

**Orchestrator Output:**
```ts
{
  mode: "coach" | "support" | "gratitude" | "game" | "reminder",
  goal: "clarify_feelings" | "set_tiny_step" | "reflect" | "cheer_up" | ...
}
```

### 3. `services/sttService.ts`

- Uses OpenAI `whisper-1`:
  - Input: audio buffer
  - Output: `string` transcript
- Config:
  - Language: `uk`/`ru`/`en` (depending on target)
  - Temperature: low

### 4. `agents/listenerAgent.ts`

**Listener Agent** - First layer of processing:

- Accepts audio, transcribes via Whisper
- Extracts:
  - **Facts** (e.g., "tomorrow I'm going to the doctor")
  - **Intentions** (e.g., "need to remember to take medication")
  - **Emotions** (e.g., "I feel lonely today")
- Writes to "raw interaction log"
- Returns structured extraction result
- See `agents-and-tools.md` for full agent interface and tools

### 5. `agents/emotionAgent.ts`

- Uses LLM with `agent-emotion-classifier` prompt.
- Refines emotion detection from listener output
- Returns structured object with emotion, intensity, energy, social need.
- Tracks changes over time (e.g., mood decline for 3 days in a row)

### 6. `agents/memoryAgent.ts`

**Memory Agent** - Long-term "life facts" manager:

- Extracts important information from dialogues:
  - Family relationships
  - Hobbies
  - Patterns ("every Tuesday yoga")
- Updates profile:
  ```ts
  {
    profile: {
      name: "Maria",
      age_group: "65-75",
      livesAlone: true,
      grandchildren: 2
    },
    routines: {
      tuesday: ["yoga_class"],
      evening: ["gratitude_journal"]
    },
    preferences: {
      tone: "warm_slow",
      topicsToAvoid: ["war_news"]
    }
  }
  ```
- See `agents-and-tools.md` for available memory tools

### 7. `agents/contextEngineeringAgent.ts`

**Context Engineering Agent** - Agentic context curation:

- Takes raw RAG results + emotion state + mode + user profile
- Uses LLM to intelligently filter and prioritize:
  - **Emotional filtering**: When user is sad → prioritize support memories, filter out triggering topics
  - **Mode-based selection**: Coach mode → active goals, Support mode → recent gratitude
  - **Preference respect**: Filters out topics user wants to avoid
  - **Open loop prioritization**: Medications, appointments get higher priority
  - **Temporal relevance**: Recent events weighted higher
  - **Relationship awareness**: Trust level affects what to mention
- Forms curated context snapshot:
  ```ts
  {
    current_mood: "...",
    health_snapshot: "...",
    today: {
      sleep: 5.5,
      steps: 1200
    },
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
    context_for_planner: "...", // structured summary for Planner
    context_for_coach: "..." // different structure for Coach Agent
  }
  ```
- **Why Agentic?**
  - Simple RAG returns top-k by similarity, but doesn't consider context
  - This agent actively decides what matters NOW based on:
    - Emotional state
    - Conversation mode
    - User preferences
    - Temporal relevance
    - Relationship dynamics

### 8. `agents/plannerAgent.ts` (formerly modeAgent)

**Planner Agent** - Decides interaction strategy:

- Rule-based + optional LLM booster
- Decides what's appropriate now:
  - Just listen
  - Ask questions
  - Summarize
  - Propose small experiment/action
  - Remind about previous goal
- Forms "interaction goal" for LLM:
  - "Calm down, show you remember about doctor tomorrow, gently suggest a walk."
- Inputs:
  - `last_emotion` (sad/joy/anxious, intensity, energy)
  - `user_profile` (psychological portrait)
  - `open_loops` (plans/promises/goals)
  - `last_mode` (small_talk/coach/game/gratitude/reminder)
- Output:
  ```ts
  {
    mode: "coach" | "support" | "gratitude" | "game" | "reminder",
    goal: "clarify_feelings" | "set_tiny_step" | "reflect" | "cheer_up" | ...
  }
  ```

### 9. `agents/coachAgent.ts`

**Coach Agent** - Core coaching skillset:

- Main LLM call with `system-life-companion` and `agent-coach` prompts
- Implements coaching modes:
  1. **Active listening + reflection**
     - "As I heard, you're feeling..."
     - "It sounds like this is important to you because..."
  2. **Open questions (GROW-style)**
     - Goal: "What would you like more of in your day/week?"
     - Reality: "How does this look right now?"
     - Options: "What 2-3 options could we try?"
     - Will: "Where would you like to start tomorrow?"
  3. **Micro-goals / tiny habits**
     - Instead of "you need to move more" →
     - "How about a 5-minute walk after lunch today? Does that feel realistic for you?"
  4. **Emotional normalization**
     - "It's normal to feel this way in such a situation."
     - "Many people feel similar when..."
  5. **Reframing**
     - Instead of "I can't get anything done" →
     - "It seems like you want more control over your day. Let's find a way to add at least one small thing you can definitely do."
  6. **Support + autonomy**
     - "I'm here to support you, but the decision is always yours."
     - "What feels like the best next step to you?"
  7. **Accountability (very soft)**
     - "Last week you said you wanted to go out more often. What do you think helped or hindered you?"
- See `agents-and-tools.md` for coaching tools and techniques
- Produces:
  - natural language reply
  - optional suggested actions (update goals / log gratitude)

### 10. `agents/toneAgent.ts`

- Pure TypeScript mapping from:
  - emotion
  - mode
  - personality profile
- To ElevenLabs params:
  ```ts
  interface ToneParams {
    stability: number | [number, number]; // single value or range
    similarityBoost: number | [number, number];
    style: "soft" | "conversational" | "serious" | "excited" | "emotional" | "narration";
    toneInstruction: string;
  }
  ```

- Complete tonal map (8 modes, all from single voice):
  ```ts
  const toneMappings = {
    warmEmpathic: {
      stability: [0.65, 0.75],
      style: "Soft + Emotional",
      similarity: 0.6,
      instruction: "speak gently, warmly, slowly and with soft pauses"
    },
    calmSoothing: {
      stability: [0.7, 0.85],
      style: "Soft",
      similarity: 0.5,
      instruction: "speak slowly, soothingly, even slower at the end of sentences"
    },
    supportiveCaring: {
      stability: [0.55, 0.65],
      style: "Conversational + Soft",
      similarity: 0.7,
      instruction: "caringly but confidently, like a friend who supports"
    },
    coachGrounded: {
      stability: [0.6, 0.8],
      style: "Serious + Conversational",
      similarity: 0.9,
      instruction: "speak confidently, calmly, in a structured tone, without rush"
    },
    reflectiveThoughtful: {
      stability: [0.5, 0.6],
      style: "Narration",
      similarity: 0.8,
      instruction: "speak as if gently reflecting on what you heard"
    },
    cheerfulLight: {
      stability: [0.35, 0.5],
      style: "Excited + Conversational",
      similarity: [0.5, 0.6],
      instruction: "light, elevated tone, soft smile in the voice"
    },
    playfulEnergetic: {
      stability: [0.3, 0.45],
      style: "Excited",
      similarity: 0.7,
      instruction: "play with intonation, add light humor"
    },
    seriousDirect: {
      stability: [0.8, 0.95],
      style: "Serious",
      similarity: 1.0,
      instruction: "clearly, structured, without extra emotions, slower than usual"
    }
  };
  ```

- The agent selects appropriate mode based on emotion state, mode, and user profile, then maps to one of these 8 tonal configurations.

### 11. `services/ttsService.ts`

- Wraps ElevenLabs REST API
- Accepts:
  - `text: string`
  - `tone: ToneParams`
- Returns:
  - `Buffer` with audio (e.g., `audio/mpeg`)

### 12. `services/memoryService.ts`

- Functions:
  - `loadContext(userId, userUtteranceText)`
    - fetches profile
    - fetches last mode & mood
    - performs RAG on:
      - `facts`
      - `goals`
      - `gratitude`
  - `persistTurn(...)`
    - writes conversation turn
    - extracts & saves new facts/goals/gratitude when appropriate
    - updates mood snapshot

### 13. `services/healthService.ts` (MVP/Mock)

**Apple Health / Apple Watch Integration (MVP):**

- Mock data provider for hackathon:
  - Steps, heart rate, sleep
  - Simulator: "Your heart rate was higher this morning — perhaps you didn't sleep well?"
- Basic logic:
  - If steps low → inspire walk
  - If sleep short → suggest meditation
- Works as context-aware AI input

### 14. `services/gameService.ts`

**MemoryCare Games:**

- Voice-only, call-and-response exercises managed entirely through audio:
  - Agent delivers spoken instructions, confirms readiness, and signals pacing with tones or short verbal cues.
  - User replies via microphone; STT confidence scores determine whether to accept answers or request clarification/repeat.
  - Supports patterns such as "remember N words", "repeat this number sequence", "spot the odd word out" without relying on visuals.
- Difficulty adapts per user by adjusting sequence length, speed, and pause duration; adaptation logic is deterministic so results can be audited.
- Emits structured events to Observability + Memory services so nightly summaries can reference cognitive engagement streaks.

### 15. `services/ritualService.ts`

**Companion Rituals** - Forms emotional connection:

- Morning message:
  - "Good morning, Maria. How are you feeling?"
- Evening ritual:
  - "What brought you warmth today?"
- Weekly summary:
  - "Let's remember three warm moments from the week."
- Rituals → consistency → feeling of care

### 16. `services/reminderService.ts`

**Medication & Task Reminders:**

- Soft reminders ("Would you like me to remind you now?")
- Can postpone tasks ("Can we move this to tomorrow?")
- Maintains "Personal timeline"

### 17. `observability/phoenixClient.ts`

- Sends events to Phoenix:
  - `trackSpan(span: PhoenixSpan)`
  - `trackEval(eval: PhoenixEval)`

---

## Error Handling

- Wrap external calls (OpenAI, ElevenLabs, Firestore) in small wrappers:
  - Retry on 5xx and network timeouts (1–2 retries).
  - On failure:
    - log to console + Phoenix
    - respond with a fallback message.

---

## Security & Config

- `.env` / environment variables:
  - `OPENAI_API_KEY`
  - `ELEVENLABS_API_KEY`
  - `GOOGLE_APPLICATION_CREDENTIALS` (if using key file; on Cloud Run, use attached service account)
  - `PHOENIX_API_URL` (if needed)

- CORS:
  - Allow frontend origin for dev (e.g., `http://localhost:3000`).
- Rate limiting:
  - For hackathon, optional.
  - Basic mitigation: do not accept more than 1 active request per user/session at a time.
