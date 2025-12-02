import type { PhysicalStateSummary } from '../clients/physicalEngineClient.js';
import type { MindBehaviorState } from '../clients/mindBehaviorEngineClient.js';

/**
 * Removes duplicate facts by normalizing and comparing them.
 */
export function deduplicateFacts(facts: string[]): string[] {
  const seen = new Set<string>();
  return facts.filter(fact => {
    const normalized = fact.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Converts trend strings to compact symbols.
 */
export function formatTrendSymbol(trend: string): string {
  return trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→';
}

/**
 * Compresses physical health state into a compact string format.
 * Format: "HR: 83bpm↑ (med), SpO2: 97%→ | Steps: 6798"
 */
export function compressHealthSummary(state: PhysicalStateSummary | null): string {
  if (!state) return '';
  
  const vitals = state.vitals
    .slice(0, 2)
    .map(v => `${v.label}: ${v.value}${v.unit}${formatTrendSymbol(v.trend)} (${v.risk})`)
    .join(', ');
  
  const lifestyle = state.lifestyle
    .slice(0, 1)
    .map(l => `${l.label}: ${l.value}${l.unit}`)
    .join(', ');
  
  return vitals ? `${vitals} | ${lifestyle}` : '';
}

/**
 * Compresses mind/behavior state into a compact string format.
 * Format: "Emotional State: steady (0.66), Cognitive State: steady (0.59)"
 */
export function compressMindSummary(state: MindBehaviorState | null): string {
  if (!state) return '';
  
  return state.domains
    .slice(0, 2)
    .map(d => `${d.label}: ${d.status} (${d.score.toFixed(2)})`)
    .join(', ');
}

