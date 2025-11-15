import { config } from '../config.js';

const baseUrl = () => config.schedulingUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'scheduling service error');
    throw new Error(text);
  }
  return response.json() as Promise<T>;
}

export function sendNotification(payload: Record<string, unknown>) {
  return request('/send-notification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
