import cors from 'cors';
import express from 'express';
import EventSource from 'eventsource';
import { z } from 'zod';

import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT ?? 4202);
const eventBusUrl = process.env.EVENT_BUS_URL ?? 'http://localhost:4300';
const memoryManagerUrl = process.env.MEMORY_MANAGER_URL ?? 'http://localhost:4103';

const app = express();
app.use(cors());
app.use(express.json());

const safetyEventSchema = z.object({
  user_id: z.string(),
  turn_id: z.string(),
  reason: z.string().optional(),
  physical_summary: z.string().optional(),
  mind_behavior_summary: z.string().optional(),
});

async function fetchSafetyProfile(userId: string) {
  const response = await fetch(`${memoryManagerUrl}/memory/${userId}/safety-profile`);
  if (!response.ok) {
    throw new Error(`Safety profile fetch failed ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function connectToBus() {
  const source = new EventSource(`${eventBusUrl}/events/stream/safety.trigger.v1`);
  console.log('Safety Agent subscribed to safety.trigger.v1');

  source.onmessage = async (event) => {
    if (!event.data) {
      return;
    }
    try {
      const payload = JSON.parse(event.data);
      const parsed = safetyEventSchema.safeParse(payload.payload ?? payload);
      if (!parsed.success) {
        console.warn('Safety Agent invalid payload', payload);
        return;
      }
      const profile = await fetchSafetyProfile(parsed.data.user_id).catch((error) => {
        console.error('Safety Agent profile fetch failed', error);
        return null;
      });
      console.log('Safety Agent evaluating trigger', {
        userId: parsed.data.user_id,
        turnId: parsed.data.turn_id,
        reason: parsed.data.reason,
        escalationContacts: profile?.escalationContacts ?? [],
      });
    } catch (error) {
      console.error('Safety Agent event parse error', error);
    }
  };

  source.onerror = (error) => {
    console.error('Safety Agent SSE error', error);
  };
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'safety-agent', time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Safety Agent listening on port ${port}`);
  connectToBus();
});
