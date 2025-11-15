import { config } from '../config.js';

export function publishDialogueCommand(payload: Record<string, unknown>) {
  return fetch(`${config.eventBusUrl}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      topic: 'safety.command.v1',
      event: payload,
    }),
  });
}
