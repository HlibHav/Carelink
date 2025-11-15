import { config } from '../config.js';

interface EventPayload {
  topic: string;
  event: Record<string, unknown>;
}

export async function publishEvent(topic: string, event: Record<string, unknown>): Promise<void> {
  const baseUrl = config.services.eventBusUrl;
  const payload: EventPayload = { topic, event };

  const response = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Event Bus error');
    console.error('Failed to publish event', topic, text);
  }
}
