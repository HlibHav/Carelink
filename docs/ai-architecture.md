# AI Architecture

LifeCompanion uses a **multi-agent orchestration pattern** built with **Langchain/Langgraph** on top of OpenAI, with a single voice from ElevenLabs.

The key components:

- **Listener Agent** - STT + extract facts/intentions/emotions
- **Emotion Classifier Agent** - Refine emotion detection
- **Memory Agent** - Long-term "life facts" manager
- **Context Engineering Agent** - Agentic context formation and curation
- **Planner Agent** - Decides interaction strategy
- **Coach/Companion Agent** - Core coaching skillset
- **Tone Selector Agent** - Voice tone adaptation
- **Memory Manager (Semantic RAG)** - Retrieval and storage

These are *conceptual agents* implemented via:
- Dedicated functions in the backend
- Langchain/Langgraph orchestration framework
- Some of them backed by LLM calls with specific prompts (see `prompts/`)
- Extensible agent framework with tools system (see `agents-and-tools.md`)

---

## Conversation Loop

For each human–agent turn:

1. **Input**
   - User speaks (5–40 seconds)
   - Client sends audio → Backend
   - Backend uses Whisper → text transcript
   - Optionally extracts simple audio features (duration, amplitude) for energy estimation

2. **Emotion Classification**
   - Input: user text (and optionally audio features)
   - Output:
     ```json
     {
       "primary_emotion": "sadness | joy | anxiety | loneliness | calm | neutral",
       "intensity": "low | medium | high",
       "energy": "low | medium | high",
       "social_need": "wants_connection | wants_space | wants_guidance | unknown"
     }
     ```
   - Implemented via an OpenAI chat completion with a strict JSON schema.

3. **Context Loading & Engineering (Memory + Agentic)**
   - **Memory Manager**: Base RAG retrieval
     - Compute embeddings for the new utterance
     - Brute-force cosine similarity against:
       - `facts` (life events, family, routines)
       - `goals` (habits, intentions)
       - `gratitude` (positive memories)
     - Select top-k (e.g. 10–20) candidates per category
   - **Context Engineering Agent**: Intelligent curation
     - Takes raw RAG results + emotion state + mode + user profile
     - Actively decides what to include/exclude:
       - Filters by emotional relevance (sad → more support memories, less facts)
       - Filters by mode (coach → active goals, support → recent gratitude)
       - Respects user preferences (topics to avoid)
       - Prioritizes open loops (medications, appointments)
       - Structures context for Planner vs Coach Agent differently
     - Forms curated context snapshot:
       - Current mood & health snapshot
       - Today's metrics (sleep, steps)
       - Prioritized open loops
       - Relationship context (trust level, last positive moment)
       - Selected relevant memories (filtered & ranked)

4. **Mode Planning**
   - Mode Planner Agent decides what the companion should do next.
   - Inputs:
     - `last_mode` (e.g. support | coach | gratitude | game | reminder)
     - `emotion_state` (from step 2)
     - `user_profile`
     - `open_loops` (upcoming visits, medication reminders, goals)
   - Output:
     ```json
     {
       "mode": "support | coach | gratitude | game | reminder",
       "goal": "reflect | validate_feelings | clarify_goal | suggest_tiny_step | celebrate | ask_gratitude",
       "coach_intensity": "low | medium | high"
     }
     ```
   - Implement via:
     - Either a simple rule-based function, or
     - A small LLM call with `agent-mode-planner.md` prompt.

5. **Conversation/Coach Generation**
   - Main “brain” call: `system-life-companion` + `agent-coach` prompts.
   - Inputs:
     - user text
     - emotion state
     - mode & goal
     - relevant memory snippets (facts, goals, gratitude)
     - user profile summary
   - Output:
     - `reply_text` – what the agent says
     - `coaching_actions` (optional):
       ```json
       {
         "type": "set_goal | update_goal | log_gratitude | log_mood | none",
         "payload": { ... }
       }
       ```

6. **Tone Selection**
   - Tone Selector Agent (can be rule-based) maps:
     - `emotion_state`
     - `mode`
     - `coach_intensity`
     - `user_profile` (e.g. dislikes high energy)
   - To ElevenLabs parameters using comprehensive 8-mode tonal map (all from single voice):
     - **Warm Empathic**: stability [0.65-0.75], Soft + Emotional, similarity 0.6
     - **Calm / Soothing**: stability [0.7-0.85], Soft, similarity 0.5
     - **Supportive / Caring**: stability [0.55-0.65], Conversational + Soft, similarity 0.7
     - **Coach / Grounded**: stability [0.6-0.8], Serious + Conversational, similarity 0.9
     - **Reflective / Thoughtful**: stability [0.5-0.6], Narration, similarity 0.8
     - **Cheerful / Light**: stability [0.35-0.5], Excited + Conversational, similarity [0.5-0.6]
     - **Playful / Energetic**: stability [0.3-0.45], Excited, similarity 0.7
     - **Serious / Direct**: stability [0.8-0.95], Serious, similarity 1.0
   - Each mode includes tone instructions (e.g., "speak gently, warmly, slowly and with soft pauses")

7. **TTS & Response**
   - Combine:
     - `tone_instruction` + `reply_text`
   - Send to ElevenLabs TTS with chosen voice + params
   - Stream or send audio back to client

8. **Memory Update**
   - Log conversation turn
   - Extract new facts/goals if present
   - Compute embeddings and store them
   - Update mood snapshot for the day

---

## Agent Definitions

### Listener Agent

- **Goal**: First layer of processing - transcribe and extract structured information
- Accepts audio, transcribes via Whisper
- Extracts:
  - **Facts** (e.g., "tomorrow I'm going to the doctor")
  - **Intentions** (e.g., "need to remember to take medication")
  - **Emotions** (e.g., "I feel lonely today")
- Writes to "raw interaction log"
- Returns structured extraction result
- See `agents-and-tools.md` for tools and interface

### Emotion Classifier Agent

- **Goal**: Convert free-form user utterance into a structured emotional state
- Refines emotion detection from listener output
- Backed by LLM with strict JSON output and deterministic-ish settings
- Tracks changes over time (e.g., mood decline for 3 days in a row)
- Understands:
  - sadness / anxiety / loneliness / joy
  - intensity and energy
  - speech tempo, pauses, manner
  - temporal changes (3 days of declining mood)

### Memory Agent

- **Goal**: Long-term "life facts" manager
- Extracts important information from dialogues:
  - Family relationships
  - Hobbies
  - Patterns ("every Tuesday yoga")
- Updates profile with routines, preferences, health baseline
- Knows user's psychological portrait → individual conversation

### Context Engineering Agent

- **Goal**: Agentic context formation - intelligently curate what information to use
- **Why Agentic vs Simple RAG?**
  - Simple RAG returns top-k by similarity, but doesn't consider:
    - Emotional state (sad user needs different context than happy)
    - Mode (coach mode needs goals, support mode needs empathy)
    - User preferences (topics to avoid)
    - Temporal relevance (open loops, recent events)
    - Relationship dynamics (trust level, last positive moment)
- **Process:**
  1. Receives raw RAG results (top 10–20 per category)
  2. Receives emotion state, mode, user profile, health snapshot
  3. **LLM-based filtering & prioritization:**
     - Decides which facts/goals/gratitude are relevant NOW
     - Filters out topics user wants to avoid
     - Prioritizes open loops (medications, appointments)
     - Adapts to emotional state (more support context when sad)
     - Structures differently for Planner vs Coach Agent
  4. Forms curated context snapshot:
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
         facts: [...], // filtered & ranked
         goals: [...], // only active, relevant ones
         gratitude: [...] // recent, emotionally relevant
       },
       context_for_planner: "...", // structured summary
       context_for_coach: "..." // different structure
     }
     ```
- **Benefits:**
  - Avoids overwhelming LLM with irrelevant context
  - Adapts to emotional state and mode
  - Respects user preferences
  - Prioritizes what matters NOW
  - Reduces hallucinations by being selective

### Planner Agent (formerly Mode Planner)

- **Goal**: Decide **how** the agent should respond
- Decides what's appropriate now:
  - Just listen & validate (support)
  - Switch into a coaching moment
  - Ask for gratitude reflection
  - Initiate a memory game
  - Remind about something (if strongly relevant)
- Forms "interaction goal" for LLM:
  - "Calm down, show you remember about doctor tomorrow, gently suggest a walk."
- Inputs:
  - `last_emotion` (sad/joy/anxious, intensity, energy)
  - `user_profile` (psychological portrait)
  - `open_loops` (plans/promises/goals)
  - `last_mode` (small_talk/coach/game/gratitude/reminder)
- Output: `{ mode, goal }`

### Coach/Companion Agent

- **Goal**: Produce the natural language response with coaching skillset
- **Core coaching skills:**
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
- **Can initiate conversations:**
  - Morning: warm greeting
  - Evening: gentle summary
  - When detects sadness or fatigue → proactively writes/speaks

### Tone Selector Agent

- **Goal**: Adapt tone in each reply
- Purely technical agent that:
  - Reads `emotion_state`, `mode`, `coach_intensity`, `personality_profile`
  - Returns ElevenLabs parameters + a short tone directive
- Supports tones:
  - soft
  - calming
  - carefully-coaching
  - playful
  - serious
  - warm
- Can be implemented as:
  - A static mapping function (`if mood === "sad" and mode === "support" then ...`)
  - Or an LLM with small JSON output for exploration

### Memory Manager (Semantic RAG)

- Not an LLM agent, but an internal service that:
  - Writes structured memory to Firestore
  - Maintains embedding vectors
  - Performs semantic retrieval (base layer)
- Exposes:
  - `getRelevantContext(userId, userUtteranceText)` → `facts[], goals[], gratitude[]` (raw RAG results)
- Long-term memory capabilities:
  - Relationships
  - Routines
  - Doctors
  - Plans
  - Favorite life topics
  - Gratitude journal
- **Note**: Raw RAG results are then passed to Context Engineering Agent for intelligent curation

---

## Latency Considerations

For a smooth experience:

- Aim for:
  - Whisper transcription < 1.5s
  - Emotion + planner + conversation LLM calls combined < 2–3s
  - ElevenLabs TTS < 1.5s
- Total round-trip target: ~4–6s for a 5–20 second reply.

Options to optimize during hackathon:
- Use `gpt-4.1-mini` for emotion & planner, `gpt-4.1` for main coach agent.
- Cache user profile & last 10 turns in memory to avoid repeated Firestore lookups.
- Parallelize:
  - Emotion classification & embedding creation can run in parallel.

