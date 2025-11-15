import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { z } from 'zod';

import { config } from './config.js';
import { runDialogueTurn } from './orchestrator/dialogueAgent.js';
import { subscribeToSafetyCommands } from './subscribers/safetyCommandSubscriber.js';

const app = express();

const corsOptions = config.allowedOrigins.length ? { origin: config.allowedOrigins } : {};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

const turnSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  transcript: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

app.post('/turn', async (req, res) => {
  const parsed = turnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await runDialogueTurn({
      userId: parsed.data.userId,
      sessionId: parsed.data.sessionId,
      transcript: parsed.data.transcript,
      metadata: parsed.data.metadata,
    });
    res.json(result);
  } catch (error) {
    console.error('Dialogue turn failed', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Dialogue agent error',
    });
  }
});

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'dialogue-agent',
    time: new Date().toISOString(),
  });
});

app.listen(config.port, () => {
  console.log(`Dialogue Agent listening on port ${config.port}`);
  subscribeToSafetyCommands();
});
