import { config } from '../config.js';

export interface MemoryEntry {
  id: string;
  text: string;
  category: string;
  importance: 'low' | 'medium' | 'high';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface MemorySnapshot {
  profile?: Record<string, unknown>;
  facts: MemoryEntry[];
  goals: MemoryEntry[];
  gratitude: MemoryEntry[];
  lastMode?: string | null;
  lastEmotion?: Record<string, unknown> | null;
}

const baseUrl = () => config.services.memoryManagerUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Memory Manager call failed');
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function retrieveDialogueContext(userId: string, query: string): Promise<MemorySnapshot> {
  return request(`/memory/${userId}/retrieve-for-dialogue`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export function saveConversationTurn(
  userId: string,
  payload: {
    sessionId: string;
    turnId: string;
    role: 'user' | 'assistant';
    text: string;
    emotion?: Record<string, unknown>;
    mode?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<unknown> {
  return request(`/memory/${userId}/turns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function storeFacts(
  userId: string,
  items: Array<{ text: string; importance?: 'low' | 'medium' | 'high'; metadata?: Record<string, unknown> }>,
) {
  if (!items.length) {
    return Promise.resolve();
  }
  return request(`/memory/${userId}/store-candidate`, {
    method: 'POST',
    body: JSON.stringify({
      items: items.map((item) => ({
        category: 'facts',
        text: item.text,
        importance: item.importance ?? 'low',
        ...(item.metadata ? { metadata: item.metadata } : {}),
      })),
    }),
  });
}
