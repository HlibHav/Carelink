import { trace } from '@opentelemetry/api';

import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';
import { logLlmTrace } from '../services/traceLogger.js';
import { setLlmSpanAttributes } from '../services/phoenixClient.js';

import { loadPrompt } from './promptLoader.js';
import type {
  CoachResponse,
  ConversationContext,
  EmotionState,
  ListenerResult,
  ModePlan,
  ResponseGuidance,
} from './types.js';
import { MEMORY_POLICY_BASELINE, resolvePrivacyStatement } from './privacyPolicy.js';
import {
  deduplicateFacts,
  compressHealthSummary,
  compressMindSummary,
} from '../utils/contextCompression.js';

const systemPrompt = `${loadPrompt('system-life-companion.md')}\n\n${loadPrompt('agent-coach.md')}`;

interface CoachInput {
  listener: ListenerResult;
  emotion: EmotionState;
  plan: ModePlan;
  context: ConversationContext;
  directives: ResponseGuidance;
}

export async function generateCoachReply(input: CoachInput): Promise<CoachResponse> {
  const client = getOpenAIClient();
  const isSimpleReminder = input.plan.mode === 'reminder';

  // Build compact, structured context (deduped facts, rounded numbers)
  const identityFacts = deduplicateFacts(input.directives.identityFacts || []).slice(0, 3);
  const seenFacts = new Set(identityFacts.map(f => f.toLowerCase().trim()));
  const facts = deduplicateFacts(input.context.facts.map(f => f.text)).filter(f => {
    const normalized = f.toLowerCase().trim();
    if (seenFacts.has(normalized)) return false;
    seenFacts.add(normalized);
    return true;
  });
  const factsCompact = facts.slice(0, 3);

  const healthState = input.context.physicalState;
  const heartRate = healthState?.vitals.find(
    (v) => v.metric === 'heart_rate' || v.label.toLowerCase().includes('heart rate'),
  );
  const hrv = healthState?.vitals.find(
    (v) => v.metric === 'hrv' || v.label.toLowerCase().includes('hrv'),
  );
  const steps = healthState?.lifestyle.find(
    (l) => l.metric === 'steps' || l.label.toLowerCase().includes('step'),
  );

  const context = {
    identity: identityFacts,
    facts: factsCompact,
    goals: input.context.goals.slice(0, 1).map((g) => g.text),
    gratitude: input.context.gratitude.slice(0, 2).map((g) => g.text),
    health: healthState
      ? {
          heartRateBpm: heartRate ? Math.round(heartRate.value) : undefined,
          heartRateRisk: heartRate?.risk,
          hrvMs: hrv ? Math.round(hrv.value) : undefined,
          stepsToday: steps ? Math.round(steps.value) : undefined,
          wellbeingNote: healthState.summary || undefined,
        }
      : undefined,
    mind: input.context.mindBehaviorState ? compressMindSummary(input.context.mindBehaviorState) : undefined,
    toneHints: {
      language: (input.context as any)?.profile?.language ?? undefined,
      gentleReminder: Boolean(
        input.plan.mode === 'reminder' || input.directives.personalizationNote?.toLowerCase().includes('remind'),
      ),
      note: input.directives.personalizationNote ?? undefined,
    },
    privacy: input.directives.privacyAssurance ?? undefined,
  };
  const contextClean = JSON.parse(JSON.stringify(context));

  const customPrivacyStatement = resolvePrivacyStatement(input.context.profile);
  const memoryPolicyStatement = customPrivacyStatement ?? MEMORY_POLICY_BASELINE;

  const instructions = {
    transcript: input.listener.transcript,
    emotion: input.emotion,
    plan: input.plan,
    context: contextClean,
    memory_policy: memoryPolicyStatement,
  };

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: JSON.stringify(instructions),
    },
  ];

  const completion = await client.chat.completions.create({
    model: openAiModels.chat,
    temperature: isSimpleReminder ? 0.2 : 0.5,
    max_tokens: isSimpleReminder ? 100 : 220,
    response_format: { type: 'json_object' },
    messages,
  });

  const span = trace.getActiveSpan();
  if (span) {
    // Set LLM attributes using OpenTelemetry semantic conventions
    setLlmSpanAttributes(span, messages, {
      model: openAiModels.chat,
      choices: completion.choices,
      usage: completion.usage,
    });
    // Keep legacy events for backward compatibility
    span.addEvent('llm.prompt', { phase: 'coach_agent', prompt: JSON.stringify(messages) });
    span.addEvent('llm.response', { phase: 'coach_agent', response: JSON.stringify(completion) });
  }

  logLlmTrace({
    phase: 'coach_agent',
    model: openAiModels.chat,
    messages,
    response: completion,
    metadata: {
      userId: (input.context as any)?.profile?.id ?? undefined,
      hasName: Boolean(input.directives.preferredName),
    },
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<CoachResponse>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { text: content };
  }

  const normalizeReasoning = (reason?: string) => {
    if (!reason) return undefined;
    const words = reason.split(/\s+/).filter(Boolean).slice(0, 15);
    return words.join(' ');
  };

  const trimSentences = (text: string, maxSentences = 3) => {
    const parts = text.split(/(?<=[.?!])\s+/).slice(0, maxSentences);
    return parts.join(' ').trim();
  };

  const cleanHealthSummary =
    typeof parsed.healthSummary === 'object' && parsed.healthSummary !== null
      ? {
          ...parsed.healthSummary,
          summary: parsed.healthSummary.summary
            ? trimSentences(parsed.healthSummary.summary, 1)
            : parsed.healthSummary.summary,
        }
      : null;

  const reminders = Array.isArray(parsed.reminders)
    ? parsed.reminders.slice(0, 2)
    : (input.directives.reminders || []).slice(0, 2);
  const proposedActivities = Array.isArray(parsed.proposedActivities)
    ? parsed.proposedActivities.slice(0, 2)
    : (input.directives.suggestedActivities || []).slice(0, 2);

  const enriched: CoachResponse = {
    text: trimSentences(parsed.text ?? content ?? '', 3),
    actions: parsed.actions ?? [],
    reasoning: normalizeReasoning(parsed.reasoning),
    reminders,
    proposedActivities,
    healthSummary: isSimpleReminder && !input.directives.healthSummary ? null : cleanHealthSummary ?? input.directives.healthSummary ?? null,
    personalizationNote: parsed.personalizationNote ?? input.directives.personalizationNote,
  };

  return enriched;
}
