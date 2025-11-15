import type { ConversationContext } from '../services/memoryService.js';
import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';

import { loadPrompt } from './promptLoader.js';
import type { CoachResponse, EmotionState, ListenerResult, ModePlan } from './types.js';

const systemPrompt = `${loadPrompt('system-life-companion.md')}\n\n${loadPrompt('agent-coach.md')}`;

interface CoachInput {
  listener: ListenerResult;
  emotion: EmotionState;
  plan: ModePlan;
  context: ConversationContext;
}

export async function generateCoachReply(input: CoachInput): Promise<CoachResponse> {
  const client = getOpenAIClient();

  const contextBlocks = [
    input.context.profile ? `Profile: ${JSON.stringify(input.context.profile)}` : null,
    input.context.facts.length ? `Facts:\n${input.context.facts.map((f) => `- ${f.text}`).join('\n')}` : null,
    input.context.goals.length
      ? `Goals:\n${input.context.goals.map((f) => `- ${f.text} (${f.status ?? 'active'})`).join('\n')}`
      : null,
    input.context.gratitude.length
      ? `Gratitude:\n${input.context.gratitude.map((f) => `- ${f.text}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

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
        content: JSON.stringify({
          transcript: input.listener.transcript,
          summary: input.listener.summary,
          emotion: input.emotion,
          plan: input.plan,
          context: contextBlocks,
        }),
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

  return {
    text: parsed.text ?? content ?? '',
    actions: parsed.actions ?? [],
    reasoning: parsed.reasoning,
  };
}
