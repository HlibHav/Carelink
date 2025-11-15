import { config } from '../config.js';

export interface PhysicalStateSummary {
  userId: string;
  generatedAt: string;
  summary: string;
  vitals: Array<{
    metric: string;
    label: string;
    value: number;
    unit: string;
    baseline: number;
    trend: string;
    risk: string;
  }>;
  lifestyle: Array<{
    metric: string;
    label: string;
    value: number;
    unit: string;
    baseline: number;
    trend: string;
    risk: string;
  }>;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${config.physicalEngineUrl}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => 'Physical engine error');
    throw new Error(text);
  }
  return response.json() as Promise<T>;
}

export function getPhysicalStateSummary(userId: string): Promise<PhysicalStateSummary> {
  return request(`/state/${userId}`);
}
