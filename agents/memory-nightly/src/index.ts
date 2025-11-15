import cors from 'cors';
import express from 'express';
import { z } from 'zod';

import { config } from './config.js';
import { runDailyDigest } from './handlers/digest.js';
import { runCompress } from './handlers/compress.js';
import { evolvePlaybook } from './handlers/evolvePlaybook.js';
import { setupScheduler } from './scheduler.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const digestRequestSchema = z.object({
  date: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), 'date must be YYYY-MM-DD')
    .optional(),
});

const compressRequestSchema = z.object({
  olderThanDays: z.number().int().positive().optional(),
  dryRun: z.boolean().optional(),
});

const evolvePlaybookRequestSchema = z.object({
  dateRange: z
    .object({
      start: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), 'start date must be YYYY-MM-DD'),
      end: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), 'end date must be YYYY-MM-DD'),
    })
    .optional(),
  force: z.boolean().optional(),
});

// POST /nightly/digest/:userId - Generate daily digest
app.post('/nightly/digest/:userId', async (req, res) => {
  try {
    const parsed = digestRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await runDailyDigest(req.params.userId, parsed.data.date);
    res.json(result);
  } catch (error) {
    console.error('Error generating digest:', error);
    res.status(500).json({
      error: 'Failed to generate digest',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /nightly/compress/:userId - Compress old memories
app.post('/nightly/compress/:userId', async (req, res) => {
  try {
    const parsed = compressRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await runCompress(req.params.userId, parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Error compressing memories:', error);
    res.status(500).json({
      error: 'Failed to compress memories',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /nightly/evolve-playbook/:userId - Run ACE cycle
app.post('/nightly/evolve-playbook/:userId', async (req, res) => {
  try {
    const parsed = evolvePlaybookRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = await evolvePlaybook(req.params.userId, parsed.data);
    res.json(result);
  } catch (error) {
    console.error('Error evolving playbook:', error);
    res.status(500).json({
      error: 'Failed to evolve playbook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /healthz - Health check
app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'memory-nightly',
    time: new Date().toISOString(),
    nightlyEnabled: config.nightly.enabled,
  });
});

const port = config.port;
app.listen(port, () => {
  console.log(`Memory Nightly service listening on port ${port}`);
  console.log(`Nightly jobs enabled: ${config.nightly.enabled}`);

  if (config.nightly.enabled) {
    setupScheduler();
    console.log(`Scheduler configured with cron: ${config.nightly.scheduleCron}`);
  }
});

