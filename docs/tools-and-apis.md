# Tools and APIs

## OpenAI

### Models

- `gpt-4.1` or `gpt-4.1-mini` – main reasoning / conversation models
- `gpt-4o-mini` – quick classification tasks (emotion, mode)
- `whisper-1` – speech-to-text
- `text-embedding-3-small` – embeddings for semantic memory (RAG)

### Key Endpoints

- **Chat Completions**
  - URL: `https://api.openai.com/v1/chat/completions`
  - Use for:
    - Emotion classification
    - Mode planning
    - Conversation / coaching

- **Audio Transcriptions**
  - URL: `https://api.openai.com/v1/audio/transcriptions`
  - Use for:
    - Turning user audio into text (Whisper)

- **Embeddings**
  - URL: `https://api.openai.com/v1/embeddings`
  - Use for:
    - Computing vector embeddings for facts, goals, gratitude entries

### Patterns

- EmotionClassifier:
  - System prompt: `agent-emotion-classifier`
  - `response_format` as JSON with a strict schema.

- ModePlanner:
  - System prompt: `agent-mode-planner`
  - Input: last mode, emotion, user profile, open loops
  - Output: `mode`, `goal`, `coach_intensity`.

- CoachAgent:
  - System prompt: `system-life-companion` + `agent-coach`
  - Input: full context, including relevant memory snippets.

---

## ElevenLabs

### Voice Design

🎤 **Single Unique Companion Voice**

We use **Voice Design** in ElevenLabs to create one unique companion voice (e.g., "Mari" or "Sofi").

**Voice Characteristics:**
- Base warm, human-like timbre
- Clear pronunciation
- Neutral emotionality under standard conditions

From this single voice, we extract 100+ possible intonations by varying parameters (stability, style, similarity, tone instructions).

### TTS API

- Base URL: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Authentication: `xi-api-key` header
- Request:
  ```json
  {
    "text": "string",
    "model_id": "eleven_monolingual_v1 or similar",
    "voice_settings": {
      "stability": 0.3,
      "similarity_boost": 0.7,
      "style": 0.0,
      "use_speaker_boost": true
    }
  }
  ```
- For styles & emotional control, you can use:
  - `voice_settings` (stability, similarity_boost)
  - Voice design styles (soft, serious, excited, etc.)
  - Text "tone instruction" prepended to the user-facing content.

### Complete Emotional & Tonal Map

The system uses a comprehensive 8-mode tonal map, all derived from a single voice:

#### 🟦 1) Warm Empathic
```json
{
  "stability": [0.65, 0.75],
  "style": "Soft + Emotional",
  "similarity": 0.6,
      "instruction": "speak gently, warmly, slowly and with soft pauses"
}
```

#### 🟩 2) Calm / Soothing
```json
{
  "stability": [0.7, 0.85],
  "style": "Soft",
  "similarity": 0.5,
      "instruction": "speak slowly, soothingly, even slower at the end of sentences"
}
```

#### 🟧 3) Supportive / Caring
```json
{
  "stability": [0.55, 0.65],
  "style": "Conversational + Soft",
  "similarity": 0.7,
      "instruction": "caringly but confidently, like a friend who supports"
}
```

#### 🟨 4) Coach / Grounded (Very Important!)
```json
{
  "stability": [0.6, 0.8],
  "style": "Serious + Conversational",
  "similarity": 0.9,
      "instruction": "speak confidently, calmly, in a structured tone, without rush"
}
```

#### 🟦 5) Reflective / Thoughtful
```json
{
  "stability": [0.5, 0.6],
  "style": "Narration",
  "similarity": 0.8,
      "instruction": "speak as if gently reflecting on what you heard"
}
```

#### 🟪 6) Cheerful / Light
```json
{
  "stability": [0.35, 0.5],
  "style": "Excited + Conversational",
  "similarity": [0.5, 0.6],
      "instruction": "light, elevated tone, soft smile in the voice"
}
```

#### 🟩 7) Playful / Energetic
```json
{
  "stability": [0.3, 0.45],
  "style": "Excited",
  "similarity": 0.7,
      "instruction": "play with intonation, add light humor"
}
```

#### 🟥 8) Serious / Direct
```json
{
  "stability": [0.8, 0.95],
  "style": "Serious",
  "similarity": 1.0,
      "instruction": "clearly, structured, without extra emotions, slower than usual"
}
```

In the code, we'll map our ToneParams to ElevenLabs voice settings using these comprehensive mappings.

---

## Google Cloud

### Cloud Run

- Containerized backend
- Exposed as HTTPS endpoint

### Weaviate

**Vector Database** for semantic memory search:

- **Collection**: `Memory`
- **Vectorizer**: `text2vec-openai` (text-embedding-3-small, 1536 dimensions)
- **Properties**: userId, category, text, importance, factType, goalStatus, metadata, timestamps
- **Client**: `@carelink/weaviate-client`
- **Usage**: Semantic search for facts, goals, gratitude entries

See `docs/weaviate-setup.md` for setup instructions.

### Optional: Cloud Storage

- For storing audio logs if needed (for analysis later).
- Not required for core MVP.

---

## Phoenix (Arize Phoenix)

- Phoenix gives:
  - Traces & spans for LLM calls
  - Observability: latency, prompt/response, errors
  - Evaluation workflows

### Integration Pattern

- For hackathon:
  - Use Phoenix HTTP client or Python/TS SDK
  - On each step, send:
    - Span name (e.g., `emotion_classification`, `mode_planning`, `coach_reply`)
    - Input, output
    - Metadata (userId, sessionId, emotion, mode, etc.)

See `observability-phoenix.md` for details.

---

## Featherless / Verda (Optional, Future)

If you have time or want to show scalability:

- **Featherless**
  - Run open-weight models for:
    - emotion classification
    - light summarization
  - Can move these tasks off OpenAI for cost / control reasons.

- **Verda**
  - GPU infrastructure for training custom models:
    - emotion detection from voice
    - behavioral change models
  - For hackathon, you mostly mention this as “future scaling/ownership plan”.
