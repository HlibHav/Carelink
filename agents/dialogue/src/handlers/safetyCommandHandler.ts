import { publishEvent } from '../clients/eventBusClient.js';
import type { ConversationContext, EmotionState } from '../orchestrator/types.js';

interface SafetyCommandPayload {
  user_id: string;
  turn_id: string;
  prompt: string;
  reason?: string;
  escalation?: string;
}

export async function handleSafetyCommand(
  payload: SafetyCommandPayload,
  context: ConversationContext,
  emotion: EmotionState,
) {
  await publishEvent('safety.command.ack.v1', {
    user_id: payload.user_id,
    turn_id: payload.turn_id,
    received_at: new Date().toISOString(),
    conversation_context: {
      last_mode: context.lastMode,
      last_emotion: context.lastEmotion,
    },
  });
}
