import { publishDialogueCommand } from '../clients/dialogueCommandClient.js';
import { getSafetyProfile, logIncident } from '../clients/memoryManagerClient.js';
import { sendNotification } from '../clients/notificationClient.js';
import { safetyLog } from '../telemetry/logger.js';
import { evaluateIncident } from '../evaluator/incidentEvaluator.js';
import type { SafetyDecision } from '../evaluator/incidentEvaluator.js';

interface SafetyTrigger {
  user_id: string;
  turn_id: string;
  reason?: string;
  physical_summary?: string;
  mind_behavior_summary?: string;
  severity?: string;
  source?: string;
}

async function runDecision(trigger: SafetyTrigger): Promise<SafetyDecision> {
  const profile = await getSafetyProfile(trigger.user_id);
  const alert = {
    reason: trigger.reason,
    physical_summary: trigger.physical_summary,
    mind_behavior_summary: trigger.mind_behavior_summary,
    severity: trigger.severity,
    source: trigger.source,
  };
  return evaluateIncident({
    profile: profile as unknown as Record<string, unknown>,
    alert,
  });
}

export async function handleSafetyTrigger(trigger: SafetyTrigger) {
  safetyLog({ event: 'trigger_received', userId: trigger.user_id, metadata: trigger as unknown as Record<string, unknown> });
  const decision = await runDecision(trigger);
  safetyLog({ event: 'decision_made', userId: trigger.user_id, metadata: decision as unknown as Record<string, unknown> });

  const followUps: Promise<unknown>[] = [];

  if (decision.outcome === 'dialogue_check' && decision.conversationPrompt) {
    followUps.push(
      publishDialogueCommand({
        user_id: trigger.user_id,
        turn_id: trigger.turn_id,
        prompt: decision.conversationPrompt,
        reason: decision.summary,
      }),
    );
  }

  if (decision.outcome === 'escalate_caregiver' || decision.outcome === 'escalate_emergency') {
    followUps.push(
      sendNotification({
        user_id: trigger.user_id,
        channel: decision.outcome === 'escalate_emergency' ? 'emergency' : 'caregiver',
        message: decision.notificationMessage ?? decision.summary,
      }),
    );
  }

  followUps.push(
    logIncident({
      user_id: trigger.user_id,
      turn_id: trigger.turn_id,
      summary: decision.summary,
      outcome: decision.outcome,
      reason: trigger.reason,
    }),
  );

  await Promise.allSettled(followUps);
  safetyLog({ event: 'decision_completed', userId: trigger.user_id });
}
