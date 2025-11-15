import type { MemoryEntry } from '../clients/memoryManagerClient.js';
import type { MindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import type { PhysicalStateSummary } from '../clients/physicalEngineClient.js';
import type {
  CoachResponse,
  DialogueAgentRequest,
  DialogueAgentResponse,
  EmotionState,
  ListenerResult,
  ModePlan,
} from '@carelink/conversation-types';

export type DialogueAgentInput = DialogueAgentRequest;
export type DialogueAgentResult = DialogueAgentResponse;

export type {
  CoachResponse,
  EmotionState,
  ListenerResult,
  ModePlan,
} from '@carelink/conversation-types';

export interface ConversationContext {
  profile?: Record<string, unknown>;
  facts: MemoryEntry[];
  goals: MemoryEntry[];
  gratitude: MemoryEntry[];
  lastMode?: string | null;
  lastEmotion?: EmotionState | null;
  physicalState?: PhysicalStateSummary;
  mindBehaviorState?: MindBehaviorState;
}

export interface SafetyCommandContext {
  prompt: string;
  reason?: string;
  escalation?: string;
}
