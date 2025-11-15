# Phoenix Observability

We use **Phoenix (Arize Phoenix)** to observe and debug LLM-based behavior.

Goals:

- Trace each conversation turn end-to-end.
- Inspect prompts, responses, and intermediate decisions (emotion, mode).
- Attach labels for evals.

---

## What to Log

For every user → agent turn, we log multiple **spans**:

1. `stt.transcription`
   - Input: audio metadata (duration)
   - Output: transcript text
   - Metadata: `userId`, `sessionId`, `turnId`

2. `emotion.classification`
   - Input: transcript text
   - Output: emotion JSON (primary, intensity, energy, socialNeed)
   - Metadata: `userId`, `sessionId`, `turnId`

3. `mode.planning`
   - Input: emotion JSON + summary of user profile + last mode
   - Output: `mode`, `goal`, `coach_intensity`
   - Metadata: `userId`, `sessionId`, `turnId`

4. `memory.rag`
   - Input: user utterance embedding
   - Output: selected memories (facts, goals, gratitude entries)
   - Metadata: `userId`, `sessionId`, `turnId`, count of docs

5. `coach.reply`
   - Input: full prompt to LLM
   - Output: `replyText` + optional actions
   - Metadata: `userId`, `sessionId`, `turnId`, `mode`, `primaryEmotion`

6. `tts.elevenlabs`
   - Input: text + tone params
   - Output: audio success/failure
   - Metadata: `userId`, `sessionId`, `turnId`, `toneProfileName`

These spans can be grouped by a `trace_id` (e.g., `{sessionId}:{turnId}`).

---

## Phoenix Integration Pattern

### 1. Client Setup

Depending on language, you can:

- Use Phoenix’s official SDK (Python or TS) if available.
- Or implement a simple HTTP client that posts JSON to Phoenix’s ingestion endpoint.

Example TS client interface:

```ts
interface PhoenixSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: string;
  endTime: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}
```

Function:

```ts
async function logSpan(span: PhoenixSpan) {
  await fetch(process.env.PHOENIX_API_URL + "/api/spans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(span),
  });
}
```

### 2. Hooking into Orchestrator

Inside `handleUserUtterance`, wrap each logical step:

```ts
const spanId = uuid();
const start = new Date().toISOString();

// ... do STT

const end = new Date().toISOString();
await phoenix.logSpan({
  traceId,
  spanId,
  name: "stt.transcription",
  startTime: start,
  endTime: end,
  input: { audioMetadata },
  output: { transcript },
  metadata: { userId, sessionId, turnId },
});
```

Repeat for each span.

---

## Evals via Phoenix

Phoenix can also help with **evaluations** by:

- Attaching labels to spans:
  - `labels: { "tone_match": "good", "coach_style": "too_direct" }`
- Running offline checks:
  - E.g., export transcripts and annotations.

During hackathon, you can:

- Implement a simple **manual eval UI** or script:
  - Fetch last N conversations.
  - Score them by:
    - tone match vs emotion
    - coaching helpfulness
    - empathy level
  - Push scores back into Phoenix as eval labels.

See `evals.md` for more detail.

---

## Redaction & Privacy

- For hackathon:
  - You may log full text.
- For production:
  - Redact:
    - names
    - locations
    - explicit health info
  - Or log abstracted emotion states and categories instead of full conversation.

