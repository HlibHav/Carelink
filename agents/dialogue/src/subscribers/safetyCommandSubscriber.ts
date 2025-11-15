import EventSource from 'eventsource';
import { z } from 'zod';

import { config } from '../config.js';
import { publishEvent } from '../clients/eventBusClient.js';
import { enqueueSafetyCommand } from '../queue/safetyCommandQueue.js';

const commandSchema = z.object({
  user_id: z.string(),
  turn_id: z.string(),
  prompt: z.string().min(1),
  reason: z.string().optional(),
  escalation: z.string().optional(),
});

type SSEMessage = { data?: string };

export function subscribeToSafetyCommands() {
  const source = new EventSource(`${config.services.eventBusUrl}/events/stream/safety.command.v1`);
  console.log('[DialogueAgent] Subscribed to safety.command.v1');

  source.onmessage = async (message: SSEMessage) => {
    if (!message.data) return;
    try {
      const payload = JSON.parse(message.data);
      const parsed = commandSchema.safeParse(payload.payload ?? payload);
      if (!parsed.success) {
        console.warn('[DialogueAgent] Invalid safety command payload', payload);
        return;
      }

      enqueueSafetyCommand({
        userId: parsed.data.user_id,
        turnId: parsed.data.turn_id,
        prompt: parsed.data.prompt,
        reason: parsed.data.reason,
        escalation: parsed.data.escalation,
      });

      await publishEvent('safety.command.ack.v1', {
        user_id: parsed.data.user_id,
        turn_id: parsed.data.turn_id,
        received_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[DialogueAgent] Safety command error', error);
    }
  };

  source.onerror = (error) => {
    console.error('[DialogueAgent] Safety command SSE error', error);
  };
}
