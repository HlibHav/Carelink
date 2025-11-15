import { config } from '../config.js';

export interface MindBehaviorState {
  userId: string;
  generatedAt: string;
  summary: string;
  domains: Array<{
    domain: string;
    label: string;
    score: number;
    status: string;
    description: string;
    recommendations: string[];
  }>;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${config.mindBehaviorEngineUrl}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => 'Mind & Behavior engine error');
    throw new Error(text);
  }
  return response.json() as Promise<T>;
}

export function getMindBehaviorState(userId: string): Promise<MindBehaviorState> {
  return request(`/state/${userId}`);
}
