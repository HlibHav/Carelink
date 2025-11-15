# LifeCompanion Frontend

A Tailwind-powered React UI for demoing the LifeCompanion backend. It lets you:

- Configure auth headers that the backend requires.
- Launch new `/api/start-conversation` sessions and inspect the generated metadata.
- Send text or audio turns to `/api/user-utterance`.
- Refresh `/api/session-summary` to view the latest highlights, goals, and gratitude entries.

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env # point to your backend URL if needed
npm run dev
```

The dev server defaults to `http://localhost:5173` and proxies requests directly to the configured backend URL.

## Environment

| Variable        | Description                                     | Default                        |
| --------------- | ----------------------------------------------- | ------------------------------ |
| `VITE_API_URL`  | Base API URL (should include `/api` suffix)     | `http://localhost:8080/api`    |

## UI Flow

1. **Auth Headers** – Fill in the token, user ID, and device ID expected by the backend middleware.
2. **Launch Conversation** – Adjust locale/capabilities, then press “Start Conversation”. The session card populates with IDs, upload URLs, and ice breakers.
3. **Send Utterance** – Type a transcript (or attach audio) and press “Send”. Each submission shows up in the conversation timeline with backend acknowledgements.
4. **Session Summary** – Once turns are flowing, hit “Refresh” to call `/api/session-summary` and render demo insights.

## Scripts

- `npm run dev` – Start Vite in development mode.
- `npm run build` – Type-check and produce a production build.
- `npm run preview` – Preview the built assets.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS for theming
- Modern, componentized layout (cards, timeline, forms) inspired by the docs in `/docs`.
