import { config } from '../config.js';

const baseUrl = () => config.memoryManagerUrl;

export interface CoachMemorySnapshot {
  userId: string;
  goals: Array<{
    id: string;
    text: string;
    importance: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  openLoops?: Array<Record<string, unknown>>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => 'Memory Manager error');
    throw new Error(text);
  }
  return response.json() as Promise<T>;
}

export function retrieveCoachContext(userId: string): Promise<CoachMemorySnapshot> {
  return request(`/memory/${userId}/retrieve-for-coach`);
}

export function storeCoachRecommendation(
  userId: string,
  plan: { summary: string; actions: Array<{ title: string; when?: string; details?: string }> },
) {
  if (!plan.actions.length) {
    return Promise.resolve();
  }
  return request(`/memory/${userId}/store-candidate`, {
    method: 'POST',
    body: JSON.stringify({
      items: plan.actions.map((action) => ({
        category: 'goals',
        text: `${action.title}${action.when ? ` (${action.when})` : ''}`,
        importance: 'medium',
        metadata: {
          summary: plan.summary,
          details: action.details ?? null,
        },
      })),
    }),
  });
}
