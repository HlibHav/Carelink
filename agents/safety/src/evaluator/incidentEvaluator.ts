import { getOpenAIClient, safetyModel } from '../services/openAIClient.js';

interface IncidentContext {
  profile: Record<string, unknown>;
  alert: Record<string, unknown>;
}

export type SafetyOutcome = 'monitor' | 'dialogue_check' | 'escalate_caregiver' | 'escalate_emergency';

export interface SafetyDecision {
  outcome: SafetyOutcome;
  summary: string;
  conversationPrompt?: string;
  notificationMessage?: string;
}

const systemPrompt = `You are the CareLink Safety Agent. Given the safety profile and an alert, decide whether to:
1) monitor,
2) ask the Dialogue Agent to check in,
3) escalate to caregiver,
4) escalate to emergency services.
Return JSON { "outcome": "monitor|dialogue_check|escalate_caregiver|escalate_emergency", "summary": "...", "conversationPrompt": optional string, "notificationMessage": optional string }.`;

export async function evaluateIncident(context: IncidentContext): Promise<SafetyDecision> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: safetyModel,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(context) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<SafetyDecision>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    outcome: parsed.outcome ?? 'monitor',
    summary: parsed.summary ?? 'Monitor and log incident.',
    conversationPrompt: parsed.conversationPrompt,
    notificationMessage: parsed.notificationMessage,
  };
}
