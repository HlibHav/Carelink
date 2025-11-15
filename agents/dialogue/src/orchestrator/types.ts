import type { MemoryEntry } from '../clients/memoryManagerClient.js';
import type { MindBehaviorState } from '../clients/mindBehaviorEngineClient.js';
import type { PhysicalStateSummary } from '../clients/physicalEngineClient.js';
import type {
  CoachResponse,
  DialogueAgentRequest,
  DialogueAgentResponse,
  EmotionState,
  HealthSummary,
  ListenerResult,
  ModePlan,
  RoutineReminder,
  SuggestedActivity,
} from '@carelink/conversation-types';

export type DialogueAgentInput = DialogueAgentRequest;
export type DialogueAgentResult = DialogueAgentResponse;

export type {
  CoachResponse,
  EmotionState,
  ListenerResult,
  ModePlan,
  RoutineReminder,
  SuggestedActivity,
  HealthSummary,
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

export interface ResponseGuidance {
  preferredName?: string;
  identityFacts: string[];
  gratitudeHighlights: string[];
  reminders: RoutineReminder[];
  suggestedActivities: SuggestedActivity[];
  healthSummary?: HealthSummary | null;
  planningCues: string[];
  socialTopics: string[];
  personalizationNote?: string;
}
