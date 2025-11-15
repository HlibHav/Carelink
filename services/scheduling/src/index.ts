import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT ?? 4205);

type TaskRecord = {
  taskId: string;
  userId: string;
  time: string;
  payload: Record<string, unknown>;
  status: 'scheduled' | 'cancelled';
  createdAt: string;
  cancelledAt?: string;
};

const tasks = new Map<string, TaskRecord>();

const scheduleSchema = z.object({
  user_id: z.string(),
  time: z.string(),
  payload: z.record(z.unknown()),
});

app.post('/schedule-task', (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const taskId = `task_${randomUUID()}`;
  const record: TaskRecord = {
    taskId,
    userId: parsed.data.user_id,
    time: parsed.data.time,
    payload: parsed.data.payload,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  };
  tasks.set(taskId, record);
  res.status(201).json(record);
});

const cancelSchema = z.object({
  taskId: z.string(),
});

app.post('/cancel-task', (req, res) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const task = tasks.get(parsed.data.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  task.status = 'cancelled';
  task.cancelledAt = new Date().toISOString();
  tasks.set(task.taskId, task);
  res.json(task);
});

app.get('/tasks', (_req, res) => {
  res.json(Array.from(tasks.values()));
});

app.post('/send-notification', (req, res) => {
  // stub endpoint for notification dispatch
  res.json({ status: 'queued', payload: req.body ?? {} });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'scheduling-service', time: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Scheduling service listening on port ${port}`);
});
