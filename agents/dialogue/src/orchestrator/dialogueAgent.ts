import { randomUUID } from 'node:crypto';

import { publishEvent } from '../clients/eventBusClient.js';
import { getMindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import { getPhysicalStateSummary } from '../clients/physicalEngineClient.js';
import { retrieveDialogueContext, saveConversationTurn, storeFacts } from '../clients/memoryManagerClient.js';
import { dequeueSafetyCommand } from '../queue/safetyCommandQueue.js';

import { generateCoachReply } from './coachAgent.js';
import { refineEmotionState } from './emotionAgent.js';
import { runListenerAgent } from './listenerAgent.js';
import { planNextTurn } from './plannerAgent.js';
import { determineTone } from './toneAgent.js';
import type {
  ConversationContext,
  DialogueAgentInput,
  DialogueAgentResult,
  EmotionState,
} from './types.js';

async function buildConversationContext(userId: string, transcript: string): Promise<ConversationContext> {
  const [memory, physical, mindBehavior] = await Promise.all([
    retrieveDialogueContext(userId, transcript),
    getPhysicalStateSummary(userId).catch((error) => {
      console.error('Physical engine unavailable', error);
      return undefined;
    }),
    getMindBehaviorState(userId).catch((error) => {
      console.error('Mind & Behavior engine unavailable', error);
      return undefined;
    }),
  ]);

  return {
    profile: memory.profile ?? undefined,
    facts: memory.facts ?? [],
    goals: memory.goals ?? [],
    gratitude: memory.gratitude ?? [],
    lastMode: memory.lastMode ?? null,
    lastEmotion: (memory.lastEmotion as EmotionState | null) ?? null,
    physicalState: physical,
    mindBehaviorState: mindBehavior,
  };
}

function shouldTriggerCoach(planMode: string): boolean {
  return planMode === 'coach';
}

function shouldTriggerSafety(context: ConversationContext, emotion: EmotionState): boolean {
  const highRiskVital = context.physicalState?.vitals.some((vital) => vital.risk === 'high');
  const decliningMind = context.mindBehaviorState?.domains.some((domain) => domain.status === 'declining');
  return Boolean(highRiskVital || decliningMind || emotion.socialNeed === 'wants_guidance');
}

export async function runDialogueTurn(input: DialogueAgentInput): Promise<DialogueAgentResult> {
  const turnId = `turn_${randomUUID()}`;
  const context = await buildConversationContext(input.userId, input.transcript);
  const listener = await runListenerAgent(input.transcript);
  const emotion = await refineEmotionState(listener, context.profile);
  const plan = await planNextTurn({ emotion, context });
  const coach = await generateCoachReply({
    listener,
    emotion,
    plan,
    context,
  });
  const pendingSafetyCommand = dequeueSafetyCommand(input.userId);
  if (pendingSafetyCommand) {
    coach.text = pendingSafetyCommand.prompt;
    plan.mode = 'support';
    plan.goal = 'reflect_feelings';
    await publishEvent('safety.command.handled.v1', {
      user_id: input.userId,
      turn_id: pendingSafetyCommand.turnId,
      handled_at: new Date().toISOString(),
    });
  }
  const tone = pendingSafetyCommand ? 'serious_direct' : determineTone(emotion, plan);

  await saveConversationTurn(input.userId, {
    sessionId: input.sessionId,
    turnId: `${turnId}_user`,
    role: 'user',
    text: input.transcript,
    emotion: emotion as unknown as Record<string, unknown>,
    metadata: input.metadata,
  });

  await saveConversationTurn(input.userId, {
    sessionId: input.sessionId,
    turnId: `${turnId}_assistant`,
    role: 'assistant',
    text: coach.text,
    emotion: emotion as unknown as Record<string, unknown>,
    mode: plan.mode,
  });

  if (listener.facts?.length) {
    await storeFacts(
      input.userId,
      listener.facts.map((fact) => ({ text: fact.text, importance: 'medium' })),
    );
  }

  if (shouldTriggerCoach(plan.mode)) {
    await publishEvent('coach.trigger.v1', {
      user_id: input.userId,
      turn_id: turnId,
      requested_mode: plan.mode,
      goal: plan.goal,
      reason: 'plan_mode_coach',
      created_at: new Date().toISOString(),
    });
  }

  if (shouldTriggerSafety(context, emotion)) {
    await publishEvent('safety.trigger.v1', {
      user_id: input.userId,
      turn_id: turnId,
      reason: 'high_risk_signal',
      physical_summary: context.physicalState?.summary,
      mind_behavior_summary: context.mindBehaviorState?.summary,
    });
  }

  return {
    turnId,
    transcript: input.transcript,
    listener,
    emotion,
    plan,
    coach,
    tone,
    safetyCommand: pendingSafetyCommand
      ? {
          prompt: pendingSafetyCommand.prompt,
          reason: pendingSafetyCommand.reason,
          escalation: pendingSafetyCommand.escalation,
        }
      : undefined,
  };
}
