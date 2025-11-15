import { config } from '../config.js';

export interface MemoryEntry {
  id: string;
  text: string;
  category: string;
  importance: 'low' | 'medium' | 'high';
  createdAt: string;
  metadata?: Record<string, unknown>;
  status?: string;
}

export interface MemorySnapshot {
  profile?: Record<string, unknown>;
  facts: MemoryEntry[];
  goals: MemoryEntry[];
  gratitude: MemoryEntry[];
  lastMode?: string | null;
  lastEmotion?: Record<string, unknown> | null;
}

interface TurnPayload {
  sessionId: string;
  turnId: string;
  role: 'user' | 'assistant';
  text: string;
  emotion?: Record<string, unknown>;
  mode?: string;
  metadata?: Record<string, unknown>;
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
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Memory Manager request failed (${response.status}): ${errorText}`);
  }
  return response.json() as Promise<T>;
}

export async function retrieveDialogueContext(userId: string, query: string): Promise<MemorySnapshot> {
  return request<MemorySnapshot>(`/memory/${userId}/retrieve-for-dialogue`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function saveConversationTurn(userId: string, payload: TurnPayload): Promise<void> {
  await request(`/memory/${userId}/turns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function storeCandidateMemories(
  userId: string,
  category: 'facts' | 'goals' | 'gratitude' | 'safety' | 'routine',
  items: Array<{ text: string; importance?: 'low' | 'medium' | 'high'; metadata?: Record<string, unknown> }>,
): Promise<void> {
  if (!items.length) {
    return;
  }
  await request(`/memory/${userId}/store-candidate`, {
    method: 'POST',
    body: JSON.stringify({
      items: items.map((item) => ({
        category,
        text: item.text,
        importance: item.importance ?? 'low',
        metadata: item.metadata,
      })),
    }),
  });
}
