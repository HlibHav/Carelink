# Voice Enabled Agent (LangChain + ElevenLabs)

This prototype shows how to run a LangChain reasoning loop and immediately render the response as ElevenLabs audio.  
It does **not** rely on the hosted ElevenLabs agent – the text result from the LLM is sent directly to the ElevenLabs TTS API.

## 1. Setup

1. Create a Python 3.10+ virtual environment.
2. Install the dependencies:
   ```bash
   cd services/voice-agent
   pip install -r requirements.txt
   ```
3. Provide credentials (via environment variables or an `.env` file placed in this folder):

```
OPENAI_API_KEY=sk-your-openai-key
ELEVENLABS_API_KEY=xi-your-elevenlabs-key
ELEVENLABS_VOICE_ID=aMSt68OGf4xUZAnLpTU8
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

Optional overrides:

- `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY=...` for LangSmith tracing.
- `DEFAULT_PROMPT=` to change the conversation opener in the demo script.

## 2. Run the demo

```bash
python voice_agent.py "Привіт! Як ти почуваєшся сьогодні?"
```

The script will:
1. Build a LangChain agent (`ZERO_SHOT_REACT_DESCRIPTION`) with a toy CareLink context tool.
2. Generate a response via OpenAI (configurable).
3. Stream the response text to ElevenLabs over WebSocket (no hosted agent required) and return both the plain text and MP3 audio (base64).
4. Persist the audio to `./output/last_response.mp3` for quick playback.

Sample output:

```
🧠  Agent reply: Я радий чути, що ти звернувся...
🔊  Saved audio to output/last_response.mp3
```

## 3. Reusing inside CareLink

- `VoiceEnabledAgent` can wrap any `AgentExecutor` instance from LangChain (e.g., one that already calls the Dialogue Orchestrator prompts).
- ElevenLabs WebSocket streaming is implemented via `stream_text_to_speech` so you can reuse the helper outside this script (e.g. directly from the Dialogue agent).
- The returned structure is:
- The returned structure is:
  ```python
  {
      "text": "...",
      "audio_bytes": b"...",
      "audio_base64": "...",
      "mime_type": "audio/mpeg",
      "tool_metadata": {...}
  }
  ```
  which maps cleanly onto the existing `audioBase64` fields returned by `apps/gateway`.

To integrate with the existing Node services:
1. Containerize this module or expose it via gRPC/HTTP so the Dialogue Agent can call it after each turn.
2. Alternatively, port the small `VoiceEnabledAgent` class to TypeScript by reusing `apps/gateway/src/services/elevenLabsService.ts` for synthesis.

## 4. Next steps

- Swap `ChatOpenAI` for whichever model/provider you prefer via LangChain.
- Add retrieval/memory tools so the agent can ground its responses on CareLink user data.
- Stream ElevenLabs audio chunks instead of waiting for the full buffer (`ElevenLabs.generate(..., stream=True)`).
