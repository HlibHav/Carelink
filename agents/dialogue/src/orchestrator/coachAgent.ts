import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';

import { loadPrompt } from './promptLoader.js';
import type {
  CoachResponse,
  ConversationContext,
  EmotionState,
  ListenerResult,
  ModePlan,
  ResponseGuidance,
} from './types.js';

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

  const contextBlocks = [
    input.context.profile ? `Profile: ${JSON.stringify(input.context.profile)}` : null,
    input.context.facts.length ? `Facts:\n${input.context.facts.map((f) => `- ${f.text}`).join('\n')}` : null,
    input.context.goals.length
      ? `Goals:\n${input.context.goals.map((f) => `- ${f.text} (${f.importance ?? 'active'})`).join('\n')}`
      : null,
    input.context.gratitude.length
      ? `Gratitude:\n${input.context.gratitude.map((f) => `- ${f.text}`).join('\n')}`
      : null,
    input.context.physicalState
      ? `Physical Summary:\n${input.context.physicalState.summary}\nKey vitals: ${input.context.physicalState.vitals
          .map((vital) => `${vital.label}: ${vital.value}${vital.unit} (${vital.risk})`)
          .join('; ')}`
      : null,
    input.context.mindBehaviorState
      ? `Mind & Behavior Summary:\n${input.context.mindBehaviorState.summary}\nDomains:\n${input.context.mindBehaviorState.domains
          .map((domain) => `- ${domain.label}: ${domain.status} (${domain.score})`)
          .join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const instructions = {
    transcript: input.listener.transcript,
    summary: input.listener.summary,
    emotion: input.emotion,
    plan: input.plan,
    context_blocks: contextBlocks,
    directives: input.directives,
  };

  const completion = await client.chat.completions.create({
    model: openAiModels.chat,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify(instructions),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<CoachResponse>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { text: content };
  }

  const enriched: CoachResponse = {
    text: parsed.text ?? content ?? '',
    actions: parsed.actions ?? [],
    reasoning: parsed.reasoning,
    reminders: Array.isArray(parsed.reminders) ? parsed.reminders : input.directives.reminders,
    proposedActivities: Array.isArray(parsed.proposedActivities)
      ? parsed.proposedActivities
      : input.directives.suggestedActivities,
    healthSummary:
      typeof parsed.healthSummary === 'object' && parsed.healthSummary !== null
        ? parsed.healthSummary
        : input.directives.healthSummary ?? null,
    personalizationNote: parsed.personalizationNote ?? input.directives.personalizationNote,
  };

  return enriched;
}
