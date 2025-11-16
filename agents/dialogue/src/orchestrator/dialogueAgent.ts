import { randomUUID } from 'node:crypto';

import { publishEvent } from '../clients/eventBusClient.js';
import { getMindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import { getPhysicalStateSummary } from '../clients/physicalEngineClient.js';
import { retrieveDialogueContext, saveConversationTurn, storeFacts } from '../clients/memoryManagerClient.js';
import type { MemoryEntry } from '../clients/memoryManagerClient.js';
import { dequeueSafetyCommand } from '../queue/safetyCommandQueue.js';

import { generateCoachReply } from './coachAgent.js';
import { buildResponseGuidance, extractPreferredName } from './guidanceBuilder.js';
import { refineEmotionState } from './emotionAgent.js';
import { runListenerAgent } from './listenerAgent.js';
import { planNextTurn } from './plannerAgent.js';
import { determineTone } from './toneAgent.js';
const derivedFactCache = new Map<string, Set<string>>();

import type {
  ConversationContext,
  DialogueAgentInput,
  DialogueAgentResult,
  EmotionState,
  ModePlan,
  ResponseGuidance,
} from './types.js';

function hasDerivedFact(userId: string, key: string, facts: MemoryEntry[]): boolean {
  if (facts.some((fact) => fact.metadata?.derivedKey === key)) {
    return true;
  }
  return derivedFactCache.get(userId)?.has(key) ?? false;
}

function registerDerivedFact(userId: string, key: string): void {
  if (!derivedFactCache.has(userId)) {
    derivedFactCache.set(userId, new Set());
  }
  derivedFactCache.get(userId)!.add(key);
}

async function ensureDerivedFacts(userId: string, context: ConversationContext): Promise<void> {
  const additions: Array<{
    key: string;
    text: string;
    importance: 'low' | 'medium' | 'high';
    metadata: Record<string, unknown>;
  }> = [];

  const preferredName = extractPreferredName(context.profile);
  if (preferredName) {
    const key = `profile:name:${preferredName.toLowerCase()}`;
    if (!hasDerivedFact(userId, key, context.facts)) {
      additions.push({
        key,
        text: `Мене звати ${preferredName}.`,
        importance: 'medium',
        metadata: { derivedKey: key, value: preferredName },
      });
    }
  }

  if (context.physicalState?.summary) {
    const dayKey = context.physicalState.generatedAt?.slice(0, 10) ?? 'latest';
    const key = `physical:summary:${dayKey}`;
    if (!hasDerivedFact(userId, key, context.facts)) {
      additions.push({
        key,
        text: `Самопочуття: ${context.physicalState.summary}`,
        importance: 'low',
        metadata: {
          derivedKey: key,
          generatedAt: context.physicalState.generatedAt,
        },
      });
    }
  }

  const notableVital =
    context.physicalState?.vitals.find((vital) => vital.risk === 'high') ??
    context.physicalState?.vitals.find((vital) => vital.risk === 'medium');
  if (notableVital) {
    const dayKey = context.physicalState?.generatedAt?.slice(0, 10) ?? 'latest';
    const key = `physical:vital:${notableVital.metric}:${dayKey}`;
    if (!hasDerivedFact(userId, key, context.facts)) {
      additions.push({
        key,
        text: `${notableVital.label}: ${notableVital.value}${notableVital.unit} (${notableVital.risk} ризик).`,
        importance: 'low',
        metadata: {
          derivedKey: key,
          metric: notableVital.metric,
          value: notableVital.value,
          unit: notableVital.unit,
          risk: notableVital.risk,
          generatedAt: context.physicalState?.generatedAt,
        },
      });
    }
  }

  if (!additions.length) {
    return;
  }

  await storeFacts(
    userId,
    additions.map((addition) => ({
      text: addition.text,
      importance: addition.importance,
      metadata: addition.metadata,
    })),
  );

  const createdAt = new Date().toISOString();
  additions.forEach((addition) => {
    registerDerivedFact(userId, addition.key);
    context.facts.unshift({
      id: `derived-${addition.key}-${randomUUID()}`,
      text: addition.text,
      category: 'facts',
      importance: addition.importance,
      createdAt,
      metadata: addition.metadata,
    });
  });
}

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

function shouldTriggerCoach(planMode: string, guidance: ResponseGuidance): boolean {
  return (
    planMode === 'coach' ||
    planMode === 'reminder' ||
    guidance.reminders.length > 0 ||
    guidance.suggestedActivities.length > 0
  );
}

function shouldTriggerSafety(context: ConversationContext, emotion: EmotionState): boolean {
  const highRiskVital = context.physicalState?.vitals.some((vital) => vital.risk === 'high');
  const decliningMind = context.mindBehaviorState?.domains.some((domain) => domain.status === 'declining');
  return Boolean(highRiskVital || decliningMind || emotion.socialNeed === 'wants_guidance');
}

export async function runDialogueTurn(input: DialogueAgentInput): Promise<DialogueAgentResult> {
  const turnId = `turn_${randomUUID()}`;
  const context = await buildConversationContext(input.userId, input.transcript);
  await ensureDerivedFacts(input.userId, context);
  const listener = await runListenerAgent(input.transcript);
  const emotion = await refineEmotionState(listener, context.profile);
  const initialPlan = await planNextTurn({ emotion, context });
  const guidance = buildResponseGuidance({ context, listener, emotion });
  const plan = adjustPlanWithGuidance(initialPlan, guidance);
  const coach = await generateCoachReply({
    listener,
    emotion,
    plan,
    context,
    directives: guidance,
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

  if (!coach.reminders?.length && guidance.reminders.length) {
    coach.reminders = guidance.reminders.slice(0, 2);
  }
  if (!coach.proposedActivities?.length && guidance.suggestedActivities.length) {
    coach.proposedActivities = guidance.suggestedActivities.slice(0, 2);
  }
  if (!coach.healthSummary && guidance.healthSummary) {
    coach.healthSummary = guidance.healthSummary;
  }
  if (!coach.personalizationNote && guidance.personalizationNote) {
    coach.personalizationNote = guidance.personalizationNote;
  }

  const coachTriggerReason = determineCoachTriggerReason(plan, guidance);

  if (coachTriggerReason && shouldTriggerCoach(plan.mode, guidance)) {
    await publishEvent('coach.trigger.v1', {
      user_id: input.userId,
      turn_id: turnId,
      requested_mode: plan.mode,
      goal: plan.goal,
      reason: coachTriggerReason,
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

function adjustPlanWithGuidance(plan: ModePlan, guidance: ResponseGuidance): ModePlan {
  const updatedPlan: ModePlan = { ...plan };
  if (guidance.reminders.length && plan.mode !== 'reminder') {
    updatedPlan.mode = 'reminder';
    updatedPlan.goal = 'check_in_on_goal';
  } else if (guidance.suggestedActivities.length && plan.mode === 'support') {
    updatedPlan.mode = 'coach';
    updatedPlan.goal = 'suggest_tiny_step';
  }
  return updatedPlan;
}

function determineCoachTriggerReason(plan: ModePlan, guidance: ResponseGuidance): string | null {
  if (plan.mode === 'coach') {
    return 'plan_mode_coach';
  }
  if (plan.mode === 'reminder' || guidance.reminders.length) {
    return 'routine_follow_up';
  }
  if (guidance.suggestedActivities.length) {
    return 'social_boost';
  }
  return null;
}
