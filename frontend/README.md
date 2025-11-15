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

## Scripts

- `npm run dev` – Start Vite in development mode.
- `npm run build` – Type-check and produce a production build.
- `npm run preview` – Preview the built assets.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS for theming
- `@elevenlabs/react` + `@elevenlabs/client` for the hosted agent experience
- Modern, componentized layout (cards, timeline, forms) inspired by the docs in `/docs`.
