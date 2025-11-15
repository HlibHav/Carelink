import { config } from '../config.js';

export interface SafetyProfile {
  userId: string;
  escalationContacts?: Array<{ name: string; channel: string; destination: string }>;
  policies?: Record<string, unknown>;
}

const baseUrl = () => config.memoryManagerUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'memory manager error');
    throw new Error(text);
  }
  return response.json() as Promise<T>;
}

export function getSafetyProfile(userId: string): Promise<SafetyProfile> {
  return request(`/memory/${userId}/safety-profile`);
}

export function logIncident(payload: Record<string, unknown>) {
  return request(`/memory/${payload.user_id ?? 'unknown'}/store-candidate`, {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          category: 'safety',
          text: payload.summary ?? 'Safety incident logged',
          importance: 'high',
          metadata: payload,
        },
      ],
    }),
  });
}
