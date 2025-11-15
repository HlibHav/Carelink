import { config } from '../config.js';

export interface DialogueAgentRequest {
  userId: string;
  sessionId: string;
  transcript: string;
  metadata?: Record<string, unknown>;
}

export interface DialogueAgentResponse {
  turnId: string;
  transcript: string;
  listener: Record<string, unknown>;
  emotion: Record<string, unknown>;
  plan: Record<string, unknown>;
  coach: { text: string; actions?: Array<{ type: string; text: string }>; reasoning?: string };
  tone: string;
}

export async function runDialogueAgentTurn(payload: DialogueAgentRequest): Promise<DialogueAgentResponse> {
  const response = await fetch(`${config.services.dialogueAgentUrl}/turn`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Dialogue agent error');
    throw new Error(text);
  }

  return response.json() as Promise<DialogueAgentResponse>;
}
