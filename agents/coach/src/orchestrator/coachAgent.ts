import { publishEvent } from '../clients/eventBusClient.js';
import { storeCoachRecommendation } from '../clients/memoryManagerClient.js';

import { buildCoachContext } from './contextBuilder.js';
import { generateCoachPlan } from './planGenerator.js';
import type { CoachTriggerEvent } from './types.js';

export async function handleCoachTrigger(event: CoachTriggerEvent): Promise<void> {
  const context = await buildCoachContext(event.userId);
  const plan = await generateCoachPlan(context, event);

  await Promise.allSettled([
    storeCoachRecommendation(event.userId, plan),
    publishEvent('coach.plan.ready.v1', {
      user_id: event.userId,
      turn_id: event.turnId,
      summary: plan.summary,
      focus_domains: plan.focusDomains,
      actions: plan.actions,
      conversation_starters: plan.conversationStarters,
    }),
  ]);
}
