import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';

import { loadPrompt } from './promptLoader.js';
<<<<<<<< HEAD:agents/dialogue/src/orchestrator/plannerAgent.ts
import type { EmotionState, ModePlan, ConversationContext } from './types.js';
========
import type {
  EmotionState,
  ModePlan,
  ConversationContext,
} from './types.js';

type MemoryEntry = ConversationContext['goals'][number];
>>>>>>>> origin/main:apps/gateway/src/orchestrator/plannerAgent.ts

const plannerPrompt = loadPrompt('agent-mode-planner.md');

interface PlannerInput {
  emotion: EmotionState;
<<<<<<<< HEAD:agents/dialogue/src/orchestrator/plannerAgent.ts
  context: ConversationContext;
========
  profile?: Record<string, unknown>;
  openLoops?: MemoryEntry[];
  lastMode?: string;
  localTime?: string;
  physicalStateSummary?: ConversationContext['physicalState'];
  mindBehaviorSummary?: ConversationContext['mindBehaviorState'];
>>>>>>>> origin/main:apps/gateway/src/orchestrator/plannerAgent.ts
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
<<<<<<<< HEAD:agents/dialogue/src/orchestrator/plannerAgent.ts
          user_profile: input.context.profile ?? null,
          open_loops: input.context.goals ?? [],
          last_mode: input.context.lastMode ?? null,
          local_time: new Date().toISOString(),
          physical_state: input.context.physicalState ?? null,
          mind_behavior_state: input.context.mindBehaviorState ?? null,
========
          user_profile: input.profile ?? null,
          open_loops: input.openLoops ?? [],
          last_mode: input.lastMode ?? null,
          local_time: input.localTime ?? new Date().toISOString(),
          physical_state: input.physicalStateSummary ?? null,
          mind_behavior_state: input.mindBehaviorSummary ?? null,
>>>>>>>> origin/main:apps/gateway/src/orchestrator/plannerAgent.ts
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
