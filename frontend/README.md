# LifeCompanion Frontend

A Tailwind-powered React UI for demoing the LifeCompanion backend. It lets you:

- Configure auth headers that the backend requires.
- Launch new `/api/start-conversation` sessions and inspect the generated metadata.
- Send text or audio turns to `/api/user-utterance`.
- Refresh `/api/session-summary` to view the latest highlights, goals, and gratitude entries.
- Talk to an ElevenLabs Agent via the official `@elevenlabs/react` SDK without leaving the page.

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env # point to your backend URL if needed
npm run dev
```

The dev server defaults to `http://localhost:5173` and proxies requests directly to the configured backend URL.

## Environment

| Variable                           | Description                                                                 | Default                        |
| ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| `VITE_API_URL`                    | Base API URL (should include `/api` suffix)                                 | `http://localhost:8080/api`    |
| `VITE_ELEVENLABS_AGENT_ID`        | Public Agent ID (auto-fills the hosted widget)                              | _(empty)_                      |
| `VITE_ELEVENLABS_SIGNED_URL`      | Signed URL for private WebSocket agents                                     | _(empty)_                      |
| `VITE_ELEVENLABS_CONVERSATION_TOKEN` | Conversation token for private WebRTC agents                             | _(empty)_                      |
| `VITE_ELEVENLABS_CONNECTION_TYPE` | `webrtc` or `websocket` when using an Agent ID                              | `webrtc`                       |
| `VITE_ELEVENLABS_SERVER_LOCATION` | `us`, `global`, `eu-residency`, or `in-residency`                            | `us`                           |
| `VITE_ELEVENLABS_USER_ID`         | Default user identifier passed to ElevenLabs                                | `demo-user`                    |
| `VITE_ELEVENLABS_AUTO_CONNECT`    | Leave empty to auto-connect once the backend shares a token, set `true` to force it for env config, or `false` to disable | _auto (connect after config)_  |
| `VITE_ELEVENLABS_TEXT_ONLY`       | `true` to run the hosted widget without audio                               | `false`                        |
| `VITE_ELEVENLABS_VOLUME`          | Initial agent playback volume (0–1)                                         | `0.85`                         |
| `VITE_ELEVENLABS_DEBUG`           | `true` to emit verbose console logs from the embedded agent panel           | `false` (only dev mode logs)   |

## UI Flow

1. **Auth Headers** – Fill in the token, user ID, and device ID expected by the backend middleware.
2. **Launch Conversation** – Adjust locale/capabilities, then press “Start Conversation”. The session card populates with IDs, upload URLs, and ice breakers.
3. **Send Utterance** – Type a transcript (or attach audio) and press “Send”. Each submission shows up in the conversation timeline with backend acknowledgements.
4. **Session Summary** – Once turns are flowing, hit “Refresh” to call `/api/session-summary` and render demo insights.
5. **Hosted Agent** – Scroll down to the “ElevenLabs Agents Widget” card. The frontend now fetches the agent config from the backend, requests mic access, and connects automatically once a token comes back. Set `VITE_ELEVENLABS_AUTO_CONNECT=false` if you want to opt out, or `true` to force auto-connect even when you supply IDs via env vars. Otherwise you can paste the IDs manually and hit **Connect**. The panel streams transcripts, metadata, and lets you send manual turns/feedback through the official `@elevenlabs/react` SDK.
6. **Orb View** – Visit `http://localhost:5173/convai` to open a distraction-free screen with a single animated orb that reflects the agent’s state (connecting, listening, speaking). The orb auto-connects using the same ElevenLabs configuration/environment variables as the main widget, so you can test an immersive kiosk-like experience.

## ElevenLabs Hosted Agent

The frontend integrates with ElevenLabs hosted agents through a **client tool** that delegates dialogue orchestration to CareLink. When the ElevenLabs agent needs to process a user turn, it invokes the `carelink_dialogue_orchestrator` client tool, which forwards the transcript to CareLink's `/api/elevenlabs/dialogue-turn` endpoint and returns the orchestrated response.

### Client Tool Setup

Before using the hosted agent, you must register the client tool with your ElevenLabs agent:

```bash
# From the project root
node scripts/ensure-elevenlabs-client-tool.mjs
```

This script requires:
- `ELEVENLABS_API_KEY` – Your ElevenLabs API key
- `ELEVENLABS_AGENT_ID` – The ID of the agent to configure

The script registers the `carelink_dialogue_orchestrator` tool with your agent, enabling it to call CareLink's dialogue orchestrator when processing user turns.

### Client Tool Implementation

The client tool is implemented in `src/lib/elevenLabsTools.ts` and provides:

- **Automatic transcript extraction** from various parameter formats
- **Session and user ID resolution** from tool parameters or defaults
- **Error handling** with detailed logging
- **Telemetry** for monitoring tool invocations and backend responses

When invoked, the tool:
1. Extracts the user transcript from the tool parameters
2. Resolves session and user IDs (with fallbacks)
3. Sends a POST request to `/api/elevenlabs/dialogue-turn`
4. Returns the orchestrated response text to the ElevenLabs agent

### Observability

The client tool logs all invocations and responses to the browser console:

- `[ElevenLabs Client Tool] Tool call initiated` – When the tool is invoked
- `[ElevenLabs Client Tool] Backend response received` – On successful response
- `[ElevenLabs Client Tool] Backend request failed` – On errors
- `[API] Sending dialogue turn request` – API-level logging
- `[API] Dialogue turn response received` – API-level success logging

Each log entry includes:
- Tool call ID for tracing
- Timestamps
- Request/response metadata (turn ID, duration, emotion, mode)
- Error details (if applicable)

### Required Environment Variables

For the client tool to work, ensure these are set:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API base URL (must include `/api`) | Yes |
| `VITE_ELEVENLABS_AGENT_ID` | ElevenLabs agent ID (or fetch from backend) | Recommended |
| `VITE_ELEVENLABS_USER_ID` | Default user ID for tool calls | Optional |

The frontend also requires valid auth configuration (token, user ID, device ID) to authenticate requests to the backend.

## Scripts

- `npm run dev` – Start Vite in development mode.
- `npm run build` – Type-check and produce a production build.
- `npm run preview` – Preview the built assets.
- `npm test` – Run Playwright integration tests.
- `npm run test:ui` – Run Playwright tests with UI mode.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS for theming
- `@elevenlabs/react` + `@elevenlabs/client` for the hosted agent experience
- Modern, componentized layout (cards, timeline, forms) inspired by the docs in `/docs`.
