# CareLink Scheduling & Notification Service

Deterministic stub for the `schedule_task`, `cancel_task`, and `send_notification` APIs described in `docs/architecture/carelink_system_spec_cursor_ready.md`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST /schedule-task` | Schedule a task/reminder. Body: `{ user_id, time, payload }`. |
| `POST /cancel-task` | Cancel a scheduled task. Body: `{ taskId }`. |
| `POST /send-notification` | Stub endpoint that echoes back the payload. |
| `GET /tasks` | Inspect in-memory scheduled tasks. |
| `GET /healthz` | Liveness probe. |

All data is stored in-memory for now, so restarting the service clears state.

## Running locally

```bash
cd services/scheduling
npm install
npm run dev
```

Environment variables:
- `PORT` (default `4205`)
