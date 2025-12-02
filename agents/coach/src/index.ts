import cors from 'cors';
import express from 'express';
import EventSource from 'eventsource';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { z } from 'zod';

import { config } from './config.js';
import { handleCoachTrigger } from './orchestrator/coachAgent.js';
import { initPhoenixOtel } from './phoenixOtel.js';

initPhoenixOtel('coach-agent');

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
      const tracer = trace.getTracer('coach-agent');
      const span = tracer.startSpan('coach.trigger');
      await context.with(trace.setSpan(context.active(), span), async () => {
        const payload = JSON.parse(message.data);
        const parsed = coachEventSchema.safeParse(payload.payload ?? payload);
        if (!parsed.success) {
          console.warn('[CoachAgent] Received invalid payload', payload);
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'invalid_payload' });
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
        span.setStatus({ code: SpanStatusCode.OK });
      });
    } catch (error) {
      console.error('[CoachAgent] Event processing error', error);
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
