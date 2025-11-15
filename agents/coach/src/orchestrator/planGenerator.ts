import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { coachModel, getOpenAIClient } from '../services/openAIClient.js';

import type { CoachContext, CoachPlanResult, CoachTriggerEvent } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const promptPath = join(__dirname, '../../../prompts/coach-plan-generator.md');
const systemPrompt = readFileSync(promptPath, 'utf-8');

export async function generateCoachPlan(
  context: CoachContext,
  trigger: CoachTriggerEvent,
): Promise<CoachPlanResult> {
  const client = getOpenAIClient();

  const payload = {
    trigger: {
      mode: trigger.requestedMode ?? 'coach',
      goal: trigger.goal ?? null,
      reason: trigger.reason ?? 'coach_trigger',
      turn_id: trigger.turnId,
      created_at: trigger.createdAt ?? new Date().toISOString(),
    },
    physical: context.physical ?? null,
    mind_behavior: context.mindBehavior ?? null,
    goals: context.goals ?? [],
  };

  const completion = await client.chat.completions.create({
    model: coachModel,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<CoachPlanResult>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const focusDomains =
    Array.isArray((parsed as { focus_domains?: unknown }).focus_domains)
      ? ((parsed as { focus_domains?: string[] }).focus_domains ?? [])
      : [];
  const conversationStarters =
    Array.isArray((parsed as { conversation_starters?: unknown }).conversation_starters)
      ? ((parsed as { conversation_starters?: string[] }).conversation_starters ?? [])
      : [];

  return {
    summary: parsed.summary ?? 'Provide gentle encouragement and revisit goals.',
    focusDomains,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    conversationStarters,
  };
}
