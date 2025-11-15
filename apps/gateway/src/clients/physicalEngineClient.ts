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

export interface TrendSeries {
  userId: string;
  metric: string;
  windowDays: number;
  points: Array<{ dayOffset: number; value: number }>;
}

const baseUrl = () => config.services.physicalEngineUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, init);
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Physical engine call failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getPhysicalStateSummary(userId: string): Promise<PhysicalStateSummary> {
  return request<PhysicalStateSummary>(`/state/${userId}`);
}

export function getPhysicalTrend(userId: string, metric: string, windowDays = 7): Promise<TrendSeries> {
  const params = new URLSearchParams({ window: String(windowDays) });
  return request<TrendSeries>(`/trends/${userId}/${metric}?${params.toString()}`);
}
