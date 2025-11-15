import type { MemoryEntry } from '../services/memoryService.js';
import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';

import { loadPrompt } from './promptLoader.js';
import type { EmotionState, ModePlan } from './types.js';

const plannerPrompt = loadPrompt('agent-mode-planner.md');

interface PlannerInput {
  emotion: EmotionState;
  profile?: Record<string, unknown>;
  openLoops?: MemoryEntry[];
  lastMode?: string;
  localTime?: string;
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
          user_profile: input.profile ?? null,
          open_loops: input.openLoops ?? [],
          last_mode: input.lastMode ?? null,
          local_time: input.localTime ?? new Date().toISOString(),
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
