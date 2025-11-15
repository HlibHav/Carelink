import { getMindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import { getPhysicalStateSummary } from '../clients/physicalEngineClient.js';
import { retrieveCoachContext } from '../clients/memoryManagerClient.js';

import type { CoachContext } from './types.js';

export async function buildCoachContext(userId: string): Promise<CoachContext> {
  const [memorySnapshot, physical, mindBehavior] = await Promise.all([
    retrieveCoachContext(userId).catch((error) => {
      console.error('Coach Agent: failed to fetch memory context', error);
      return { userId, goals: [] };
    }),
    getPhysicalStateSummary(userId).catch((error) => {
      console.warn('Coach Agent: physical engine unavailable', error);
      return undefined;
    }),
    getMindBehaviorState(userId).catch((error) => {
      console.warn('Coach Agent: mind & behavior engine unavailable', error);
      return undefined;
    }),
  ]);

  return {
    userId,
    goals: memorySnapshot?.goals ?? [],
    openLoops:
      memorySnapshot && 'openLoops' in memorySnapshot
        ? (memorySnapshot as { openLoops?: Array<Record<string, unknown>> }).openLoops ?? []
        : [],
    physical,
    mindBehavior,
  };
}
