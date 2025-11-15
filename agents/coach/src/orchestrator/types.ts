import type { MindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import type { PhysicalStateSummary } from '../clients/physicalEngineClient.js';

export interface CoachTriggerEvent {
  userId: string;
  turnId: string;
  requestedMode?: string;
  goal?: string;
  reason?: string;
  createdAt?: string;
}

export interface CoachContext {
  userId: string;
  goals: Array<{
    id: string;
    text: string;
    importance: string;
    createdAt: string;
  }>;
  openLoops?: Array<Record<string, unknown>>;
  physical?: PhysicalStateSummary;
  mindBehavior?: MindBehaviorState;
}

export interface CoachPlanAction {
  title: string;
  when?: string;
  category?: string;
  details?: string;
  followUpPrompt?: string;
}

export interface CoachPlanResult {
  summary: string;
  focusDomains: string[];
  actions: CoachPlanAction[];
  conversationStarters: string[];
}
