export interface AuthConfig {
  token: string;
  userId: string;
  deviceId: string;
  clientVersion: string;
}

export interface StartConversationPayload {
  locale: string;
  capabilities: {
    audioFormat: string;
    supportsText: boolean;
    wantsProactiveGreeting: boolean;
  };
  context: {
    timezone?: string;
    entryPoint?: string;
  };
}

export interface StartConversationResponse {
  sessionId: string;
  expiresAt: string;
  websocketUrl: string;
  uploadUrl: string;
  shouldAgentSpeakFirst: boolean;
  initialPromptToken: string;
  iceBreakers: string[];
}

export interface UtteranceResponse {
  turnId: string;
  sessionId: string;
  stream: {
    websocket: string;
    sse: string;
  };
  estimatedProcessingMs: number;
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  moodTrend: 'improving' | 'stable' | 'declining';
  bullets: string[];
  capturedGoals: Array<{ goalId: string; text: string; status: 'active' | 'done' }>;
  gratitudeEntries: Array<{ entryId: string; text: string }>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'coach' | 'system';
  text: string;
  timestamp: string;
  meta?: string;
}

export interface UtterancePayload {
  transcript?: string;
  durationMs?: number;
  audioFile?: File | null;
}

export interface SessionFormState {
  locale: string;
  timezone: string;
  entryPoint: string;
  audioFormat: string;
  supportsText: boolean;
  wantsProactiveGreeting: boolean;
}

export type TonePreset =
  | 'warm_empathic'
  | 'calm_soothing'
  | 'supportive_caring'
  | 'coach_grounded'
  | 'reflective_thoughtful'
  | 'cheerful_light'
  | 'playful_energetic'
  | 'serious_direct';

export interface VoiceAgentRequest {
  text: string;
  tone?: TonePreset;
  format?: 'audio/mpeg' | 'audio/wav';
}

export interface VoiceAgentResponse {
  tone: TonePreset;
  mimeType: string;
  instruction: string;
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style_preset?: string;
  };
  audio: {
    base64: string;
    dataUri: string;
  };
}
