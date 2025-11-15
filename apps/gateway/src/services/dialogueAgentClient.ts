import type { DialogueAgentRequest, DialogueAgentResponse } from '@carelink/conversation-types';

import { config } from '../config.js';
import { errors } from '../shared/httpErrors.js';

export type { DialogueAgentRequest, DialogueAgentResponse };

const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 30_000;

let consecutiveFailures = 0;
let circuitOpenedAt: number | null = null;

const resetCircuit = () => {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
};

const recordFailure = () => {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenedAt = Date.now();
  }
};

const ensureCircuitClosed = () => {
  if (circuitOpenedAt === null) {
    return;
  }
  if (Date.now() - circuitOpenedAt > CIRCUIT_OPEN_MS) {
    resetCircuit();
    return;
  }
  throw errors.serviceUnavailable('Dialogue agent temporarily unavailable. Please try again later.');
};

export async function runDialogueAgentTurn(payload: DialogueAgentRequest): Promise<DialogueAgentResponse> {
  ensureCircuitClosed();

  let response: Response;
  try {
    response = await fetch(`${config.services.dialogueAgentUrl}/turn`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    recordFailure();
    throw errors.serviceUnavailable('Dialogue agent unreachable.');
  }

  if (!response.ok) {
    recordFailure();
    const text = await response.text().catch(() => 'Dialogue agent error');
    throw errors.serviceUnavailable(text);
  }

  resetCircuit();

  return response.json() as Promise<DialogueAgentResponse>;
}
