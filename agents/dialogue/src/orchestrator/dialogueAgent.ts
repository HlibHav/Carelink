import { randomUUID } from 'node:crypto';

import { publishEvent } from '../clients/eventBusClient.js';
import { getMindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import { getPhysicalStateSummary } from '../clients/physicalEngineClient.js';
import { retrieveDialogueContext, saveConversationTurn, storeFacts } from '../clients/memoryManagerClient.js';
import type { MemoryEntry } from '../clients/memoryManagerClient.js';
import { dequeueSafetyCommand } from '../queue/safetyCommandQueue.js';
import { captureSpan, logSpan } from '../services/phoenixClient.js';

import { generateCoachReply } from './coachAgent.js';
import { buildResponseGuidance, extractPreferredName } from './guidanceBuilder.js';
import { refineEmotionState } from './emotionAgent.js';
import { runListenerAgent } from './listenerAgent.js';
import { planNextTurn } from './plannerAgent.js';
import { determineTone } from './toneAgent.js';
const derivedFactCache = new Map<string, Set<string>>();
const physicalCache = new Map<string, { data: Awaited<ReturnType<typeof getPhysicalStateSummary>>; fetchedAt: number }>();
const mindCache = new Map<string, { data: Awaited<ReturnType<typeof getMindBehaviorState>>; fetchedAt: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000;

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
        text: `Well-being: ${context.physicalState.summary}`,
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
        text: `${notableVital.label}: ${notableVital.value}${notableVital.unit} (${notableVital.risk} risk).`,
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

/**
 * Build conversation context with preloaded long-term memory.
 * Always uses semantic search via embeddings to access memories from any past session.
 * Memory is automatically retrieved before every turn for cross-session continuity.
 */
async function buildConversationContext(userId: string, transcript: string): Promise<ConversationContext> {
  // Preload memory using semantic search - always pass the transcript as query
  // This ensures automatic memory retrieval before every turn, accessing all past conversations
  // regardless of session ID (cross-session long-term memory)
  const memoryQuery = transcript.trim().length > 0 ? transcript : 'user context and memories';
  
  const now = Date.now();
  const [memory, physical, mindBehavior] = await Promise.all([
    retrieveDialogueContext(userId, memoryQuery), // Always use semantic search
    (async () => {
      const cached = physicalCache.get(userId);
      if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
      const fresh = await getPhysicalStateSummary(userId).catch((error) => {
        console.error('Physical engine unavailable', error);
        return undefined;
      });
      if (fresh) physicalCache.set(userId, { data: fresh, fetchedAt: now });
      return fresh;
    })(),
    (async () => {
      const cached = mindCache.get(userId);
      if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
      const fresh = await getMindBehaviorState(userId).catch((error) => {
        console.error('Mind & Behavior engine unavailable', error);
        return undefined;
      });
      if (fresh) mindCache.set(userId, { data: fresh, fetchedAt: now });
      return fresh;
    })(),
  ]);

  // Helpers to trim payload size for faster LLM latency
  const dedupeByText = (items: MemoryEntry[] = []) => {
    const seen = new Set<string>();
    const result: MemoryEntry[] = [];
    for (const item of items) {
      const txt = (item.text ?? '').trim();
      if (!txt || seen.has(txt.toLowerCase())) continue;
      seen.add(txt.toLowerCase());
      result.push(item);
    }
    return result;
  };

  const sortByImportance = (items: MemoryEntry[] = []) =>
    [...items].sort((a, b) => {
      const score = (val?: string) => (val === 'high' ? 2 : val === 'medium' ? 1 : 0);
      return score(b.importance as string) - score(a.importance as string);
    });

  const topGoals = sortByImportance(dedupeByText(memory.goals ?? [])).slice(0, 3);
  const topFacts = dedupeByText(memory.facts ?? []).slice(0, 10);
  const topGratitude = dedupeByText(memory.gratitude ?? []).slice(0, 3);

  return {
    profile: memory.profile ?? undefined,
    facts: topFacts,
    goals: topGoals,
    gratitude: topGratitude,
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
  const traceId = `${input.sessionId}:${turnId}`;
  const baseMetadata = { userId: input.userId, sessionId: input.sessionId, turnId };
  const turnSpanId = randomUUID();
  const turnStartTime = new Date().toISOString();

  const { result: context } = await captureSpan(
    'context.build',
    {
      traceId,
      parentSpanId: turnSpanId,
      input: { transcript: input.transcript },
      metadata: baseMetadata,
    },
    () => buildConversationContext(input.userId, input.transcript),
  );

  const fastPathReminder = context.lastMode === 'reminder' || input.transcript.trim().length < 80;

  const [_, listenerSpan] = await Promise.all([
    captureSpan(
      'context.ensure_derived_facts',
      {
        traceId,
        parentSpanId: turnSpanId,
        input: { profile: context.profile, physicalState: context.physicalState },
        metadata: baseMetadata,
      },
      () => ensureDerivedFacts(input.userId, context),
    ),
    captureSpan(
      'listener.agent',
      {
        traceId,
        parentSpanId: turnSpanId,
        input: { transcript: input.transcript },
        metadata: baseMetadata,
      },
      () => runListenerAgent(input.transcript),
    ),
  ]);
  const listener = listenerSpan.result;

  let emotion = listener.emotion as EmotionState;
  let plan: ModePlan;

  if (fastPathReminder) {
    emotion = {
      primary: 'neutral',
      intensity: 'low',
      energy: 'medium',
      socialNeed: 'unknown',
    };
    plan = { mode: 'reminder', goal: 'check_in_on_goal', coach_intensity: 'low' } as ModePlan;
  } else {
    const { result: refinedEmotion } = await captureSpan(
      'emotion.refine',
      {
        traceId,
        parentSpanId: turnSpanId,
        input: { listener, profile: context.profile },
        metadata: baseMetadata,
      },
      () => refineEmotionState(listener, context.profile),
    );
    emotion = refinedEmotion;

    const { result: initialPlan } = await captureSpan(
      'planner.agent',
      {
        traceId,
        parentSpanId: turnSpanId,
        input: { emotion, lastMode: context.lastMode, lastEmotion: context.lastEmotion },
        metadata: baseMetadata,
      },
      () => planNextTurn({ emotion, context }),
    );
    plan = initialPlan;
  }

  const guidance = buildResponseGuidance({ context, listener, emotion });
  plan = adjustPlanWithGuidance(plan, guidance);

  await logSpan({
    traceId,
    spanId: randomUUID(),
    parentSpanId: turnSpanId,
    name: 'response.guidance',
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    input: { listener, emotion, contextSummary: { lastMode: context.lastMode } },
    output: guidance,
    metadata: baseMetadata,
  });

  const { result: coach } = await captureSpan(
    'coach.reply',
    {
      traceId,
      parentSpanId: turnSpanId,
      input: { plan, directives: guidance },
      metadata: baseMetadata,
    },
    () =>
      generateCoachReply({
        listener,
        emotion,
        plan,
        context,
        directives: guidance,
      }),
  );
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
  const toneStart = new Date().toISOString();
  const tone =
    pendingSafetyCommand || plan.mode === 'coach'
      ? determineTone(emotion, plan)
      : 'conversational';
  await logSpan({
    traceId,
    spanId: randomUUID(),
    parentSpanId: turnSpanId,
    name: 'tone.select',
    startTime: toneStart,
    endTime: new Date().toISOString(),
    input: { emotion, plan, safetyOverride: Boolean(pendingSafetyCommand) },
    output: { tone },
    metadata: baseMetadata,
  });

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

  await logSpan({
    traceId,
    spanId: turnSpanId,
    name: 'dialogue.turn',
    startTime: turnStartTime,
    endTime: new Date().toISOString(),
    input: { transcript: input.transcript, metadata: input.metadata },
    output: {
      plan,
      tone,
      safetyCommandHandled: Boolean(pendingSafetyCommand),
    },
    metadata: baseMetadata,
  });

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
