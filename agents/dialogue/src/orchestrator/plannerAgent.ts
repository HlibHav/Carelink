import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';

import { loadPrompt } from './promptLoader.js';
import type { EmotionState, ModePlan, ConversationContext } from './types.js';

const plannerPrompt = loadPrompt('agent-mode-planner.md');

interface PlannerInput {
  emotion: EmotionState;
  context: ConversationContext;
}

export async function planNextTurn(input: PlannerInput): Promise<ModePlan> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: openAiModels.planner,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: plannerPrompt },
      {
        role: 'user',
        content: JSON.stringify({
          emotion: input.emotion,
          user_profile: input.context.profile ?? null,
          open_loops: input.context.goals ?? [],
          last_mode: input.context.lastMode ?? null,
          local_time: new Date().toISOString(),
          physical_state: input.context.physicalState ?? null,
          mind_behavior_state: input.context.mindBehaviorState ?? null,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<ModePlan>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  return {
    mode: parsed.mode ?? 'support',
    goal: parsed.goal ?? 'reflect_feelings',
    coachIntensity: parsed.coachIntensity ?? 'low',
  };
}
