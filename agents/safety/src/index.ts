import cors from 'cors';
import express from 'express';
import EventSource from 'eventsource';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { z } from 'zod';

import { config } from './config.js';
import { handleSafetyTrigger } from './handlers/safetyHandler.js';
import { initPhoenixOtel } from './phoenixOtel.js';

initPhoenixOtel('safety-agent');

const app = express();
app.use(cors());
app.use(express.json());

const triggerSchema = z.object({
  user_id: z.string(),
  turn_id: z.string(),
  reason: z.string().optional(),
  physical_summary: z.string().optional(),
  mind_behavior_summary: z.string().optional(),
  severity: z.string().optional(),
  source: z.string().optional(),
});

type SSEMessage = { data?: string };

function subscribe(topic: string) {
  const source = new EventSource(`${config.eventBusUrl}/events/stream/${topic}`);
  console.log(`[SafetyAgent] subscribed to ${topic}`);

  source.onmessage = async (message: SSEMessage) => {
    if (!message.data) return;
    try {
      const tracer = trace.getTracer('safety-agent');
      const span = tracer.startSpan(`safety.event.${topic}`);
      await context.with(trace.setSpan(context.active(), span), async () => {
        const payload = JSON.parse(message.data);
        const parsed = triggerSchema.safeParse(payload.payload ?? payload);
        if (!parsed.success) {
          console.warn('[SafetyAgent] invalid payload', payload);
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'invalid_payload' });
          return;
        }
        await handleSafetyTrigger({
          ...parsed.data,
        });
        span.setStatus({ code: SpanStatusCode.OK });
      });
    } catch (error) {
      console.error('[SafetyAgent] processing error', error);
      const active = trace.getActiveSpan();
      if (active) {
        active.recordException(error as Error);
        active.setStatus({ code: SpanStatusCode.ERROR, message: 'event_processing_error' });
      }
    } finally {
      const active = trace.getActiveSpan();
      if (active) active.end();
    }
  };

  source.onerror = (error) => {
    console.error('[SafetyAgent] SSE error', error);
  };
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'safety-agent', time: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`[SafetyAgent] listening on port ${config.port}`);
  subscribe('safety.trigger.v1');
  subscribe('physical.alert.v1');
  subscribe('mind_behavior.alert.v1');
});
