import { publishEvent } from '../clients/eventBusClient.js';
import { storeCoachRecommendation } from '../clients/memoryManagerClient.js';
import { scheduleTask, sendNotification } from '../clients/schedulingClient.js';
import { coachLog } from '../telemetry/logger.js';

import { buildCoachContext } from './contextBuilder.js';
import { generateCoachPlan } from './planGenerator.js';
import type { CoachTriggerEvent } from './types.js';

export async function handleCoachTrigger(event: CoachTriggerEvent): Promise<void> {
  coachLog({
    event: 'trigger_received',
    userId: event.userId,
    metadata: event as unknown as Record<string, unknown>,
  });
  const context = await buildCoachContext(event.userId);
  const plan = await generateCoachPlan(context, event);
  coachLog({ event: 'plan_generated', userId: event.userId, metadata: { summary: plan.summary } });

  const schedulingPromises = plan.actions
    .filter((action) => action.when)
    .map((action) =>
      scheduleTask({
        userId: event.userId,
        time: action.when!,
        payload: {
          title: action.title,
          details: action.details ?? null,
          category: action.category ?? null,
        },
      }).catch((error) => {
        coachLog({
          event: 'schedule_failed',
          userId: event.userId,
          metadata: { error: String(error), action },
        });
      }),
    );

  const notificationPromise =
    plan.conversationStarters.length > 0
      ? sendNotification({
          user_id: event.userId,
          message: plan.conversationStarters[0],
          channel: 'app',
        }).catch((error) => {
          coachLog({ event: 'notification_failed', userId: event.userId, metadata: { error: String(error) } });
        })
      : Promise.resolve();

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
    ...schedulingPromises,
    notificationPromise,
  ]);
  coachLog({ event: 'plan_completed', userId: event.userId });
}
