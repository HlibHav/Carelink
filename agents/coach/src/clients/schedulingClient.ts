import { config } from '../config.js';

const baseUrl = () => config.schedulingServiceUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Scheduling service error');
    throw new Error(text);
  }
  return response.json() as Promise<T>;
}

export function scheduleTask(input: { userId: string; time: string; payload: Record<string, unknown> }) {
  return request('/schedule-task', {
    method: 'POST',
    body: JSON.stringify({
      user_id: input.userId,
      time: input.time,
      payload: input.payload,
    }),
  });
}

export function sendNotification(payload: Record<string, unknown>) {
  return request('/send-notification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
