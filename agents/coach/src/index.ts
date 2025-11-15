import cors from 'cors';
import express from 'express';
import EventSource from 'eventsource';
import { z } from 'zod';

import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT ?? 4201);
const eventBusUrl = process.env.EVENT_BUS_URL ?? 'http://localhost:4300';
const memoryManagerUrl = process.env.MEMORY_MANAGER_URL ?? 'http://localhost:4103';

const app = express();
app.use(cors());
app.use(express.json());

const coachEventSchema = z.object({
  user_id: z.string(),
  turn_id: z.string(),
  requested_mode: z.string(),
  goal: z.string().optional(),
  reason: z.string().optional(),
  created_at: z.string().optional(),
});

async function fetchCoachContext(userId: string) {
  const response = await fetch(`${memoryManagerUrl}/memory/${userId}/retrieve-for-coach`);
  if (!response.ok) {
    throw new Error(`Memory fetch failed ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

type SSEMessage = { data?: string };

function connectToEventBus() {
  const source = new EventSource(`${eventBusUrl}/events/stream/coach.trigger.v1`);
  console.log('Coach Agent subscribed to coach.trigger.v1');

  source.onmessage = async (message: SSEMessage) => {
    if (!message.data) {
      return;
    }
    try {
      const payload = JSON.parse(message.data);
      const parsed = coachEventSchema.safeParse(payload.payload ?? payload);
      if (!parsed.success) {
        console.warn('Coach Agent received invalid payload', payload);
        return;
      }
      const context = await fetchCoachContext(parsed.data.user_id).catch((error: unknown) => {
        console.error('Coach Agent memory fetch failed', error);
        return null;
      });
      const goals = Array.isArray((context as { goals?: unknown[] } | null)?.goals)
        ? (context as { goals?: unknown[] } | null)?.goals
        : [];
      console.log('Coach Agent handling trigger', {
        userId: parsed.data.user_id,
        turnId: parsed.data.turn_id,
        requestedMode: parsed.data.requested_mode,
        goal: parsed.data.goal,
        contextSummary: goals?.length ?? 0,
      });
    } catch (error) {
      console.error('Coach Agent event parse error', error);
    }
  };

  source.onerror = (error: unknown) => {
    console.error('Coach Agent SSE error', error);
  };
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'coach-agent', time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Coach Agent listening on port ${port}`);
  connectToEventBus();
});
