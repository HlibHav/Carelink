import { trace } from '@opentelemetry/api';

import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';
import { logLlmTrace } from '../services/traceLogger.js';
import { setLlmSpanAttributes } from '../services/phoenixClient.js';

import { loadPrompt } from './promptLoader.js';
import type { EmotionState, ModePlan, ConversationContext } from './types.js';
import { compressHealthSummary, compressMindSummary } from '../utils/contextCompression.js';

const plannerPrompt = loadPrompt('agent-mode-planner.md');

interface PlannerInput {
  emotion: EmotionState;
  context: ConversationContext;
}

export async function planNextTurn(input: PlannerInput): Promise<ModePlan> {
  const client = getOpenAIClient();
  
  // Compress emotion to single string
  const emotionStr = `${input.emotion.primary}/${input.emotion.intensity}/${input.emotion.energy}`;
  
  // Extract time only (HH:MM format)
  const localTime = new Date().toISOString().split('T')[1].slice(0, 5);
  
  // Compress goals to top 2
  const goals = input.context.goals?.slice(0, 2).map(g => g.text) ?? [];
  
  // Use summary strings instead of full objects
  const healthSummary = input.context.physicalState
    ? compressHealthSummary(input.context.physicalState) || input.context.physicalState.summary
    : null;
  
  const mindSummary = input.context.mindBehaviorState
    ? compressMindSummary(input.context.mindBehaviorState) || input.context.mindBehaviorState.summary
    : null;
  
  const messages = [
    { role: 'system', content: plannerPrompt },
    {
      role: 'user',
      content: JSON.stringify({
        emotion: emotionStr,
        open_loops: goals,
        last_mode: input.context.lastMode ?? null,
        local_time: localTime,
        health: healthSummary,
        mind: mindSummary,
      }),
    },
  ];

  const completion = await client.chat.completions.create({
    model: openAiModels.planner,
    temperature: 0.2,
    max_tokens: 60,
    response_format: { type: 'json_object' },
    messages,
  });

  const span = trace.getActiveSpan();
  if (span) {
    // Set LLM attributes using OpenTelemetry semantic conventions
    setLlmSpanAttributes(span, messages, {
      model: openAiModels.planner,
      choices: completion.choices,
      usage: completion.usage,
    });
    // Keep legacy events for backward compatibility
    span.addEvent('llm.prompt', { phase: 'planner_agent', prompt: JSON.stringify(messages) });
    span.addEvent('llm.response', { phase: 'planner_agent', response: JSON.stringify(completion) });
  }

  logLlmTrace({
    phase: 'planner_agent',
    model: openAiModels.planner,
    messages,
    response: completion,
    metadata: { userId: (input.context as any)?.userId },
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
