# Requirements

## Functional Requirements

### FR-1: Voice-First Interaction

- The system MUST allow the user to:
  - Press a button to start speaking
  - Speak for 5–40 seconds in a natural way
  - Receive a voice response from the agent (no text required for the user)

- The agent MUST:
  - Be able to **initiate** a conversation (e.g., on a “Start” button or scheduled trigger)
  - Speak first with a warm greeting

### FR-2: Emotion Understanding

- The system MUST:
  - Analyze each user utterance to estimate:
    - primary emotion (sadness / anxiety / loneliness / joy)
    - intensity
    - energy
    - rough social need (connection / space / guidance)
  - Understand speech tempo, pauses, manner
  - Track changes over time (e.g., declining mood for 3 days in a row)
  - Store the emotion state with each conversation turn.

### FR-3: Adaptive Modes

- The agent MUST support at least these modes:
  - `support` – active listening and validation
  - `coach` – gentle coaching interactions
  - `gratitude` – evening gratitude reflection
  - `game` – simple memory / cognitive exercises

- The Mode Planner MUST:
  - Choose mode based on:
    - Emotion
    - User profile
    - Recent context (e.g. sequence of sad days)
    - Previously stated goals
  - Avoid switching to `coach` when user is in very high distress (then prefer `support`).

### FR-4: Coaching Behaviour (Core Coaching Skillset)

- The agent MUST implement a comprehensive coaching skillset:
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

- In `coach` mode the agent MUST:
  - Ask open-ended questions (not yes/no only)
  - Help user clarify small, realistic goals
  - Avoid giving direct commands ("You must…") and instead:
    - Propose options
    - Ask what feels realistic
  - Remember goals across sessions and check in later.

### FR-5: Gratitude Journal

- The system MUST:
  - Allow user to express 1–3 things they are grateful for.
  - Store gratitude entries in Firestore with timestamps and embeddings.
  - Be able to recall past gratitude for reflection (e.g. weekly summary).

### FR-6: Long-Term Memory

- The system MUST:
  - Store facts about:
    - family relationships
    - hobbies
    - routines (patterns like "every Tuesday yoga")
    - health-related info (non-medical, high-level)
    - doctors and medical appointments
    - plans and promises
    - favorite life topics
  - Extract important information from dialogues automatically
  - Use semantic retrieval (RAG) to:
    - re-use relevant memories in conversation
  - Never invent facts; only refer to what is actually stored.
  - Know user's psychological portrait → individual conversation

### FR-7: Tone Adaptation (Single Voice)

- The system MUST:
  - Use exactly one ElevenLabs voice ID (Voice Design: "Mari" or "Sofi")
  - Base voice characteristics:
    - Warm, human-like timbre
    - Clear pronunciation
    - Neutral emotionality under standard conditions
  - Extract 100+ possible intonations from single voice by varying parameters
  - Change tone per reply using:
    - stability
    - similarity_boost
    - style
    - text-based instructions
  - Map emotional states and modes to comprehensive 8-mode tonal map
  - Support tones:
    - soft
    - calming
    - carefully-coaching
    - playful
    - serious
    - warm

### FR-8: Session Summaries (for demo / UI)

- The system SHOULD:
  - Provide an endpoint to get a short summary of the last session:
    - ~2–4 bullet points
    - overall mood trend
    - any goals or gratitude captured

### FR-9: Phoenix Observability

- The system MUST:
  - Log LLM spans to Phoenix, including:
    - user text (possibly anonymised)
    - emotion classification output
    - mode planning decision
    - main assistant reply
    - tone parameters
  - Allow inspection of traces for debugging and evals.

### FR-10: Proactive Conversation Initiation

- The agent MUST be able to:
  - **Speak first** and lead dialogue:
    - Morning: warm greeting ("Good morning, Maria. How are you feeling?")
    - Evening: gentle summary ("What brought you warmth today?")
  - When detects sadness or fatigue → proactively write/speak
  - Initiate conversations based on context and user needs

### FR-11: Companion Rituals

- The system MUST implement rituals that form emotional connection:
  - **Morning message**: Warm greeting asking how user feels
  - **Evening ritual**: "What brought you warmth today?"
  - **Weekly summary**: "Let's remember three warm moments from the week."
- Rituals → consistency → feeling of care

### FR-12: Apple Health / Apple Watch Integration (MVP)

- The system SHOULD (for MVP/hackathon):
  - Use mock data: steps, heart rate, sleep
  - Provide context-aware insights:
    - "Your heart rate was higher this morning — perhaps you didn't sleep well?"
  - Basic logic:
    - If steps low → inspire walk
    - If sleep short → suggest meditation
  - Works as context-aware AI input

### FR-13: MemoryCare Games

- The system MUST support simple but effective brain training games that run **entirely via voice** (no screen cues). Examples:
  - "Remember three words I'll say" (spoken prompt + spoken recall)
  - "Repeat this sequence of numbers"
  - "Spot the odd word out" (verbal comparison)
- Each exercise MUST include clear spoken instructions, a confirmation step (“Are you ready?”), and audible pacing cues (e.g., chime, countdown).
- User responses MUST be captured through STT; if transcription confidence is low, the agent asks for a repeat instead of assuming success/failure.
- AI MUST adapt difficulty based on user performance while keeping responses conversational (“Let’s try four words this time.”).

### FR-14: Gratitude Journal (AI Support)

- The system MUST:
  - Support evening gratitude reflection
  - Form structured gratitude log
  - Provide positive reframing
  - Remind context:
    - "Last week you were grateful for meeting with your grandson — would you like to record something similar today?"
- AI prompts: "What small thing made you happier today?"

### FR-15: Medication & Task Reminders

- The system MUST:
  - Provide soft reminders ("Would you like me to remind you now?")
  - Allow postponing tasks ("Can we move this to tomorrow?")
  - Maintain "Personal timeline"
  - Remember medication schedules and appointments

---

## Non-Functional Requirements

### NFR-1: Latency

- Target:
  - 1 seconds from end of user speech to start of audio reply.
- Acceptable for hackathon:
  - Up to 5 seconds, with clear UI feedback (“Thinking…”).

### NFR-2: Reliability

- The backend SHOULD:
  - Handle network errors from OpenAI/ElevenLabs gracefully
  - Retry critical calls (1–2 times) when appropriate
  - Return a fallback message if external APIs fail:
    > "I'm having technical difficulties, but I'm here. Can we continue a bit later?"

### NFR-3: Privacy & Data Handling

- Personal data stored in Firestore SHOULD be minimal.
- For hackathon:
  - Use pseudonymous `userId`s (no real names required).
  - Do NOT store raw audio by default.
- The system SHOULD:
  - Provide a simple way to delete all data for a user.

### NFR-4: Observability

- The backend MUST:
  - Emit structured logs with correlation IDs per conversation.
  - Send traces to Phoenix for:
    - symmetry of prompting
    - debugging context issues
    - future evals.

### NFR-5: Extensibility

- The architecture SHOULD:
  - Allow introduction of new modes (e.g., `social`, `health-check`) with minimal changes.
  - Allow swapping emotion classifier to a custom model later (Featherless / Verda).

### NFR-6: Simplicity (Hackathon Constraint)

- The implementation SHOULD:
  - Prioritize clarity over maximal cleverness.
  - Use simple brute-force RAG for embeddings.
  - Avoid unnecessary dependencies.
