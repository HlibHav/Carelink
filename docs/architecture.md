# System Architecture

## High-Level Overview

LifeCompanion is a **voice-first AI companion & coach** delivered as a web (or desktop) client talking to a **single backend service** deployed on **Google Cloud Run**.

Core ideas:

- **Single stateless backend** handling:
  - WebSocket / HTTP for audio & text
  - Multi-agent orchestration (Langchain/Langgraph pattern)
  - Integrations with OpenAI, ElevenLabs, Firestore, Phoenix

- **Firestore** as:
  - User profile & psychological portrait store
  - Conversation logs (for safety, debugging, and RAG)
  - Structured long-term memory (facts, goals, gratitude, mood snapshots)

- **OpenAI** as:
  - STT (Whisper) for user speech → text
  - LLM (e.g. `gpt-4.1` / `gpt-4.1-mini`) for:
    - Listener Agent (extract facts/intentions/emotions)
    - Emotion Classifier Agent
    - Context Engineering Agent (agentic context curation)
    - Planner Agent (interaction strategy)
    - Coach/Companion Agent (conversation generation)
    - Semantic embeddings for RAG (`text-embedding-3-small`)

- **ElevenLabs** as:
  - One single **Voice Design** companion voice (e.g., "Mari" or "Sofi")
  - Base characteristics: warm, human-like timbre, clear pronunciation
  - 100+ intonations from single voice via parameter variation
  - Comprehensive 8-mode tonal map:
    - Warm Empathic, Calm/Soothing, Supportive/Caring
    - Coach/Grounded, Reflective/Thoughtful
    - Cheerful/Light, Playful/Energetic, Serious/Direct
  - Controlled via:
    - `stability` (ranges per mode)
    - `similarity_boost` (ranges per mode)
    - `style` (soft, conversational, serious, excited, emotional, narration)
    - text-based "tone instructions" (Ukrainian)

- **Phoenix (Arize Phoenix)** for:
  - LLM observability
  - Tracing:
    - user utterance
    - listener extraction (facts/intentions/emotions)
    - emotion classification
    - context engineering (curated context)
    - planner decisions (mode/goal)
    - RAG retrievals (raw + curated)
    - final response + TTS parameters
  - Evals

## Logical Components

1. **Client**
   - Simple web UI:
     - Mic button (record voice)
     - Text transcription display (optional)
     - Minimal controls: “Talk”, “Stop”, maybe “View today summary”
   - Sends audio chunks or full utterances to backend over HTTPS/WebSocket
   - Plays back ElevenLabs audio responses

2. **Backend (Cloud Run, Node/TS)**
   - **HTTP / WebSocket API**
     - `/api/start-conversation`
     - `/api/user-utterance`
     - `/api/session-summary` (for demo and UI)
     - `/healthz` (health check)
   - **Conversation Orchestrator** (Langchain/Langgraph pattern)
     - Receives user audio utterance
     - **Flow:**
       1. Listener Agent: STT + extract facts/intentions/emotions
       2. Emotion Classifier Agent: refine emotion detection
       3. Memory Manager: Base RAG retrieval (top 10–20 candidates)
       4. Context Engineering Agent: Intelligent curation (agentic filtering)
       5. Planner Agent: Decide mode & goal (support/coach/gratitude/game/reminder)
       6. Coach/Companion Agent: Generate reply with coaching skillset
       7. Tone Selector Agent: Select ElevenLabs parameters (8-mode map)
       8. TTS Service: Generate audio with ElevenLabs
       9. Memory Agent: Persist conversation + extract new facts/goals
       10. Observability: Log to Phoenix
   - **Agents:** (See `agents-and-tools.md` for extensible agent framework)
     - **Listener Agent**: Transcribes audio, extracts facts/intentions/emotions
     - **Emotion Classifier Agent**: Structured emotion detection with temporal tracking
     - **Memory Agent**: Long-term "life facts" manager, profile updates
     - **Context Engineering Agent**: Agentic context curation (filters by emotion/mode/preferences)
     - **Planner Agent**: Decides interaction strategy (mode/goal)
     - **Coach/Companion Agent**: Core coaching skillset (7 modes: active listening, GROW questions, micro-goals, etc.)
     - **Tone Selector Agent**: Maps emotion/mode to ElevenLabs parameters
     - **Extensible**: New agents can be added via Agent Registry (see `agents-and-tools.md`)
   - **Services:**
     - **Memory Manager (RAG)**: Base semantic retrieval, embedding creation
     - **Health Service**: Apple Health/Apple Watch integration (MVP/mock)
     - **Game Service**: MemoryCare brain training games
     - **Ritual Service**: Companion rituals (morning/evening/weekly)
     - **Reminder Service**: Medication & task reminders
     - **TTS Service**: ElevenLabs wrapper
   - **Observability Layer**
     - Sends each LLM "span" and metadata to Phoenix:
       - Inputs, outputs (with redaction)
       - Latencies
       - Agent decisions (emotion, mode, context curation)
       - RAG retrievals (raw + curated)

3. **Firestore (NoSQL)**
   - `users/{userId}` (core profile + psychological info)
   - Subcollections:
     - `profile`
     - `conversations`
     - `facts`
     - `goals`
     - `gratitude`
     - `mood_snapshots`
   - See `memory.md` for details.

4. **OpenAI**
   - Whisper:
     - `audio.transcriptions.create` (for recorded utterances)
   - Chat:
     - `chat.completions.create` for:
       - Listener Agent (extract facts/intentions/emotions)
       - Emotion Classifier Agent
       - Context Engineering Agent (agentic curation)
       - Planner Agent
       - Coach/Companion Agent
   - Embeddings:
     - `embeddings.create` with `text-embedding-3-small` for RAG

5. **ElevenLabs**
   - TTS API:
     - One Voice Design voice ID (e.g., "Mari" or "Sofi")
     - Base voice: warm, human-like timbre, clear pronunciation
     - Comprehensive 8-mode tonal map with parameter ranges
     - `stability`, `similarity_boost`, `style`, plus Ukrainian text "tone instructions"
   - Called per response, with 5–20 second chunks.
   - See `tools-and-apis.md` for complete tonal map.

6. **Phoenix**
   - Self-hosted Phoenix (e.g. in a side container / local) or managed instance
   - Backend sends spans via Python/TS client or generic HTTP:
     - `conversation_id`
     - `turn_id`
     - `user_text`
     - `listener_extraction` (facts/intentions/emotions)
     - `emotion_state`
     - `raw_rag_results` (base RAG)
     - `curated_context` (Context Engineering Agent output)
     - `mode` / `goal` (Planner Agent decision)
     - `model_input` / `model_output` (Coach Agent)
     - `tts_params` (Tone Selector Agent)
     - Optional labels: `eval_result`

## Deployment Architecture

- **Backend**
  - Written in TypeScript (Node.js)
  - Deployed to Google Cloud Run:
    - Auto-scaling
    - HTTPS endpoint
    - Access to Firestore via service account

- **Config & Secrets**
  - Environment variables:
    - `OPENAI_API_KEY`
    - `ELEVENLABS_API_KEY`
    - `GOOGLE_PROJECT_ID`
    - `GOOGLE_APPLICATION_CREDENTIALS` (for Firestore)
    - `PHOENIX_ENDPOINT` (if using Phoenix)
  - Use Google Secret Manager for production; for hackathon, `.env` + `gcloud secrets` if needed.

- **Firestore**
  - Native mode
  - Single project, regional DB

- **Phoenix**
  - For hackathon: can run locally on dev machine or as a sidecar service
  - Backend points to Phoenix via URL

