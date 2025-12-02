import { trace } from '@opentelemetry/api';

import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';
import { logLlmTrace } from '../services/traceLogger.js';
import { setLlmSpanAttributes } from '../services/phoenixClient.js';

import { loadPrompt } from './promptLoader.js';
import type { EmotionState, ListenerResult } from './types.js';

const systemPrompt = loadPrompt('agent-emotion-classifier.md');

export async function refineEmotionState(
  listener: ListenerResult,
  profileSnapshot?: Record<string, unknown>,
): Promise<EmotionState> {
  const client = getOpenAIClient();
  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: JSON.stringify({
        transcript: listener.transcript,
        listener_emotion: listener.emotions,
        user_profile: profileSnapshot ?? null,
      }),
    },
  ];

  const completion = await client.chat.completions.create({
    model: openAiModels.emotion,
    temperature: 0.1,
    max_tokens: 80,
    response_format: { type: 'json_object' },
    messages,
  });

  const span = trace.getActiveSpan();
  if (span) {
    // Set LLM attributes using OpenTelemetry semantic conventions
    setLlmSpanAttributes(span, messages, {
      model: openAiModels.emotion,
      choices: completion.choices,
      usage: completion.usage,
    });
    // Keep legacy events for backward compatibility
    span.addEvent('llm.prompt', { phase: 'emotion_agent', prompt: JSON.stringify(messages) });
    span.addEvent('llm.response', { phase: 'emotion_agent', response: JSON.stringify(completion) });
  }

  logLlmTrace({
    phase: 'emotion_agent',
    model: openAiModels.emotion,
    messages,
    response: completion,
    metadata: { transcriptLength: listener.transcript.length },
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
