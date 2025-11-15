import cors from 'cors';
import express from 'express';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT ?? 4300);
const app = express();
app.use(cors());
app.use(express.json());

type TopicName = string;

const subscribers = new Map<TopicName, Set<Response>>();

const publishSchema = z.object({
  topic: z.string().min(1),
  event: z.record(z.unknown()),
});

const subscribeSchema = z.object({
  topic: z.string().min(1),
});

const sendEvent = (topic: TopicName, payload: unknown) => {
  const targets = subscribers.get(topic);
  if (!targets || !targets.size) {
    return 0;
  }
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of targets) {
    res.write(frame);
  }
  return targets.size;
};

app.post('/events', (req, res) => {
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const delivered = sendEvent(parsed.data.topic, {
    id: randomUUID(),
    publishedAt: new Date().toISOString(),
    payload: parsed.data.event,
  });

  res.status(202).json({ delivered });
});

app.get('/events/stream/:topic', (req, res) => {
  const parsed = subscribeSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('\n');

  const topic = parsed.data.topic;
  if (!subscribers.has(topic)) {
    subscribers.set(topic, new Set());
  }
  subscribers.get(topic)!.add(res);

  req.on('close', () => {
    subscribers.get(topic)?.delete(res);
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'event-bus', time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Event Bus listening on port ${port}`);
});
