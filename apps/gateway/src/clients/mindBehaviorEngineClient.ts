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

const baseUrl = () => config.services.mindBehaviorEngineUrl;

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Mind & Behavior engine call failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getMindBehaviorStateSummary(userId: string): Promise<MindBehaviorState> {
  return request<MindBehaviorState>(`/state/${userId}`);
}
