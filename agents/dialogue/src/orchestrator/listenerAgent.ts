import { trace } from '@opentelemetry/api';

import { getOpenAIClient, openAiModels } from '../services/openAIClient.js';
import { logLlmTrace } from '../services/traceLogger.js';
import { setLlmSpanAttributes } from '../services/phoenixClient.js';

import type { ListenerResult } from './types.js';

const systemPrompt = `
You are the Listener Agent for LifeCompanion.
Analyze the provided conversation transcript and respond strictly as JSON with:
{
  "summary": "<2 sentence summary>",
  "facts": [{ "text": "", "type": "family|health|hobby|routine|other" }],
  "intents": ["..."],
  "emotions": {
    "primary": "joy|sadness|anxiety|anger|neutral",
    "intensity": "low|medium|high",
    "energy": "low|medium|high"
  }
}
Facts should only include stable information the user stated about their life. Intents capture requests or desires.
`;

export async function runListenerAgent(transcript: string): Promise<ListenerResult> {
  const client = getOpenAIClient();

  const messages = [
    { role: 'system', content: systemPrompt.trim() },
    {
      role: 'user',
      content: `Conversation transcript:\n${transcript}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model: openAiModels.chat,
    temperature: 0.2,
    max_tokens: 120,
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
    span.addEvent('llm.prompt', { phase: 'listener_agent', prompt: JSON.stringify(messages) });
    span.addEvent('llm.response', { phase: 'listener_agent', response: JSON.stringify(completion) });
  }

  logLlmTrace({
    phase: 'listener_agent',
    model: openAiModels.chat,
    messages,
    response: completion,
    metadata: { transcriptLength: transcript.length },
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<ListenerResult>;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  return {
    transcript,
    summary: parsed.summary ?? transcript.slice(0, 280),
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    intents: Array.isArray(parsed.intents) ? parsed.intents : [],
    emotions:
      parsed.emotions ?? ({
        primary: 'unknown',
        intensity: 'medium',
        energy: 'medium',
      } as ListenerResult['emotions']),
  };
}
