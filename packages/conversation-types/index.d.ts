export interface ListenerResult {
  transcript: string;
  summary: string;
  facts: Array<{ text: string; type?: string }>;
  intents: string[];
  emotions: {
    primary: string;
    intensity: 'low' | 'medium' | 'high';
    energy: 'low' | 'medium' | 'high';
  };
}

export interface EmotionState {
  primary: string;
  intensity: 'low' | 'medium' | 'high';
  energy: 'low' | 'medium' | 'high';
  socialNeed: 'wants_connection' | 'wants_space' | 'wants_guidance' | 'unknown';
  reasoning?: string;
}

export interface ModePlan {
  mode: 'support' | 'coach' | 'gratitude' | 'game' | 'reminder';
  goal:
    | 'reflect_feelings'
    | 'clarify_goal'
    | 'suggest_tiny_step'
    | 'celebrate_progress'
    | 'ask_gratitude'
    | 'lighten_mood'
    | 'check_in_on_goal';
  coachIntensity: 'low' | 'medium' | 'high';
}

export interface RoutineReminder {
  title: string;
  details?: string;
  category?: 'medication' | 'hydration' | 'movement' | 'social' | 'wellness' | 'general';
  suggestedTime?: string;
  importance?: 'low' | 'medium' | 'high';
}

export interface SuggestedActivity {
  title: string;
  description?: string;
  category?: 'movement' | 'mind' | 'social' | 'gratitude' | 'self_care';
  reason?: string;
}

export interface HealthSummary {
  summary: string;
  overallRisk?: 'low' | 'medium' | 'high';
  vitalsAtRisk?: string[];
  lifestyleNotes?: string[];
  recommendations?: string[];
}

export interface CoachResponse {
  text: string;
  actions?: Array<{ type: string; text: string }>;
  reasoning?: string;
  reminders?: RoutineReminder[];
  proposedActivities?: SuggestedActivity[];
  healthSummary?: HealthSummary | null;
  personalizationNote?: string;
}

export interface DialogueAgentRequest {
  userId: string;
  sessionId: string;
  transcript: string;
  metadata?: Record<string, unknown>;
}

export interface DialogueAgentResponse {
  turnId: string;
  transcript: string;
  listener: ListenerResult;
  emotion: EmotionState;
  plan: ModePlan;
  coach: CoachResponse;
  tone: string;
  safetyCommand?: {
    prompt: string;
    reason?: string;
    escalation?: string;
  };
}
