import cors from 'cors';
import express from 'express';
import EventSource from 'eventsource';
import { z } from 'zod';

import { config } from './config.js';
import { handleCoachTrigger } from './orchestrator/coachAgent.js';

const app = express();
app.use(cors());
app.use(express.json());

const coachEventSchema = z.object({
  user_id: z.string(),
  turn_id: z.string(),
  requested_mode: z.string().optional(),
  goal: z.string().optional(),
  reason: z.string().optional(),
  created_at: z.string().optional(),
});

type SSEMessage = { data?: string };

function connectToEventBus() {
  const source = new EventSource(`${config.eventBusUrl}/events/stream/coach.trigger.v1`);
  console.log('[CoachAgent] Subscribed to coach.trigger.v1');

  source.onmessage = async (message: SSEMessage) => {
    if (!message.data) {
      return;
    }
    try {
      const payload = JSON.parse(message.data);
      const parsed = coachEventSchema.safeParse(payload.payload ?? payload);
      if (!parsed.success) {
        console.warn('[CoachAgent] Received invalid payload', payload);
        return;
      }

      await handleCoachTrigger({
        userId: parsed.data.user_id,
        turnId: parsed.data.turn_id,
        requestedMode: parsed.data.requested_mode ?? undefined,
        goal: parsed.data.goal ?? undefined,
        reason: parsed.data.reason ?? undefined,
        createdAt: parsed.data.created_at ?? undefined,
      });
    } catch (error) {
      console.error('[CoachAgent] Event processing error', error);
    }
  };

  source.onerror = (error) => {
    console.error('[CoachAgent] SSE connection error', error);
  };
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'coach-agent', time: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`[CoachAgent] Listening on port ${config.port}`);
  connectToEventBus();
});
