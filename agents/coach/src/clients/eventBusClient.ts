import { config } from '../config.js';

export async function publishEvent(topic: string, event: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${config.eventBusUrl}/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      event,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Event bus publish failed');
    console.warn('Coach Agent unable to publish event', { topic, text });
  }
}
