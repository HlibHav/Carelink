# ElevenLabs Agent Setup & Instant Embedding

This guide summarizes the ElevenLabs Conversational AI API endpoints that we rely on (`agents/create`, `agents/get`, `agents/list`, `agents/update`, `agents/get-link`, and `mcp/create`) plus the minimal steps required to make the LifeCompanion demo auto-start a call at `http://localhost:5173/`.

All requests use the ElevenLabs base URL `https://api.elevenlabs.io/v1` and must include the `xi-api-key` header.

## 1. Create an Agent (`POST /convai/agents`)

```bash
curl -X POST "https://api.elevenlabs.io/v1/convai/agents" \
  -H "Content-Type: application/json" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -d '{
    "name": "LifeCompanion Demo",
    "tags": ["carelink", "demo"],
    "conversationConfig": {
      "agent": {
        "llm": {
          "model": "gpt-4o-mini",
          "temperature": 0.6,
          "topP": 0.9
        },
        "voice": {
          "voiceId": "'$ELEVENLABS_VOICE_ID'",
          "stability": 0.7,
          "similarityBoost": 0.6,
          "style": "soft"
        },
        "greeting": {
          "messages": [
            "Hi, I’m your companion. How are you feeling right now?"
          ]
        },
        "conversationStarters": [
          "Let’s take a breath together.",
          "Want to reflect on today for a moment?"
        ]
      },
      "asr": {
        "language": "en",
        "model": "eleven_multilingual_v2"
      },
      "turn": {
        "allowAgentInterruptions": true,
        "respeakerMode": "default"
      },
      "tts": {
        "stability": 0.65,
        "similarityBoost": 0.7,
        "useSpeakerBoost": true
      }
    },
    "platformSettings": {
      "privacy": {
        "pov": "voice",
        "modalities": ["voice"],
        "dataRetention": "default"
      }
    }
  }'
```

The response contains `agent_id`. Store it in `ELEVENLABS_AGENT_ID`.

## 2. Retrieve, List, and Update Agents

- **Get**: `GET /convai/agents/{agent_id}` returns the full config (helpful for diffing before updates).
- **List**: `GET /convai/agents?page_size=25&search=demo` surfaces every agent and cursor info.
- **Update**: `PATCH /convai/agents/{agent_id}` accepts partial payloads (`conversationConfig`, `platformSettings`, `workflow`, `name`, `tags`). Example:

```bash
curl -X PATCH "https://api.elevenlabs.io/v1/convai/agents/$ELEVENLABS_AGENT_ID" \
  -H "Content-Type: application/json" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -d '{
    "conversationConfig": {
      "agent": { "greeting": { "messages": ["It’s great to hear from you again!"] } }
    },
    "tags": ["carelink", "demo", "warm"]
  }'
```

## 3. Get the Hosted Link or Embed Config

- **Link API** (`GET /convai/agents/{agent_id}/link`): returns `{ agentId, token }`. The `token.token` field is what the frontend uses to request a WebRTC connection instantly without exposing the API key.
- **Widget API** (`GET /convai/agents/{agent_id}/widget?conversation_signature=...`): returns `widgetConfig` (iframe URL, script URL, and signing info) if you prefer to drop the prebuilt widget into another site.

Either response can be cached server-side. LifeCompanion uses the conversation token path because it flows naturally into the `@elevenlabs/client` `Conversation.startSession()` helper.

## 4. Optional: Register MCP Servers (`POST /convai/mcp-servers`)

If the agent needs to call Model Context Protocol tools hosted by you, register them:

```bash
curl -X POST "https://api.elevenlabs.io/v1/convai/mcp-servers" \
  -H "Content-Type: application/json" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -d '{
    "name": "calendar-tools",
    "baseUrl": "https://mcp.carelink.dev",
    "apiKey": "server_secret_token",
    "description": "Calendar + reminders exposed to the agent"
  }'
```

Associate the MCP server with the agent inside the ElevenLabs UI or through the Agents `workflow`/`tools` settings.

## 5. Wiring the Local App for Instant Conversations

1. Export `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in `backend/.env`. (The backend now also looks for `VITE_ELEVENLABS_AGENT_ID`, but prefer the `ELEVENLABS_*` names to avoid confusion with the frontend.) Set `ELEVENLABS_DEBUG=true` if you want verbose server logs while troubleshooting token issues. The backend route `/api/elevenlabs/agent-config` fetches fresh conversation tokens via `GET /v1/convai/conversation/token?agent_id=...`.
2. Start the backend: `cd backend && npm install && npm run dev`.
3. Start the frontend: `cd frontend && npm install && npm run dev`.
4. Visit `http://localhost:5173/`. The React widget now auto-requests the config, obtains the conversation token from the backend, handles mic permission, and calls `Conversation.startSession()` immediately. Toggle `VITE_ELEVENLABS_DEBUG=true` (frontend) for detailed console traces, and set `VITE_ELEVENLABS_AUTO_CONNECT=false` if you want to opt out of automatic calls.

With this flow, creating or updating the agent happens entirely through the ElevenLabs APIs above, and embedding simply means keeping the backend token endpoint running so the frontend can join the conversation instantly.

## 6. Register the CareLink Dialogue Orchestrator Client Tool

The hosted ElevenLabs agent must know how to call back into CareLink whenever it needs a deeply contextual response.  
We expose this as a **client tool** named `carelink_dialogue_orchestrator`, which the frontend widgets already advertise via `clientTools`.  
Run the helper script below (from the repo root) to patch your ElevenLabs agent with the required tool definition:

```bash
ELEVENLABS_API_KEY=sk-... \
ELEVENLABS_AGENT_ID=agent_123 \
node scripts/ensure-elevenlabs-client-tool.mjs
```

The script reads `.env` automatically, calls `PATCH /v1/convai/agents/{agent_id}`, and registers the tool with the correct arguments (`input`, `session_id`, `user_id`, `locale`).  
After this step, the ElevenLabs agent can invoke `carelink_dialogue_orchestrator` whenever it needs CareLink to handle a user turn. The frontend receives the tool call, forwards the transcript to `/api/elevenlabs/dialogue-turn`, and streams the orchestrated reply back to the hosted session.
