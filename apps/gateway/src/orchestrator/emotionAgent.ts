import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';

import { loadPrompt } from './promptLoader.js';
import type { EmotionState, ListenerResult } from './types.js';

const systemPrompt = loadPrompt('agent-emotion-classifier.md');

export async function refineEmotionState(
  listener: ListenerResult,
  profileSnapshot?: Record<string, unknown>,
): Promise<EmotionState> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: openAiModels.emotion,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({
          transcript: listener.transcript,
          listener_emotion: listener.emotions,
          user_profile: profileSnapshot ?? null,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<EmotionState>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  return {
    primary: parsed.primary ?? listener.emotions.primary ?? 'unknown',
    intensity: parsed.intensity ?? listener.emotions.intensity ?? 'medium',
    energy: parsed.energy ?? listener.emotions.energy ?? 'medium',
    socialNeed: parsed.socialNeed ?? 'unknown',
    reasoning: parsed.reasoning,
  };
}
