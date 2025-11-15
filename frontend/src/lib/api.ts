import type {
  AuthConfig,
  ElevenLabsDialogueTurnRequest,
  ElevenLabsDialogueTurnResponse,
  SessionSummary,
  StartConversationPayload,
  StartConversationResponse,
  UtterancePayload,
  UtteranceResponse,
  VoiceAgentRequest,
  VoiceAgentResponse,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api').replace(
  /\/$/,
  '',
);

const withAuthHeaders = (auth: AuthConfig, extra?: HeadersInit) => {
  const headers = new Headers(extra);
  headers.set('Authorization', `Bearer ${auth.token}`);
  headers.set('X-User-Id', auth.userId);
  headers.set('X-Device-Id', auth.deviceId);
  headers.set('X-Client-Version', auth.clientVersion || 'frontend-dev');
  return headers;
};

async function request<T>(path: string, init: RequestInit, auth: AuthConfig): Promise<T> {
  const bodyIsFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers = withAuthHeaders(auth, init.headers);
  if (!bodyIsFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload?.error?.message ?? message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export function startConversation(
  payload: StartConversationPayload,
  auth: AuthConfig,
): Promise<StartConversationResponse> {
  return request('/start-conversation', { method: 'POST', body: JSON.stringify(payload) }, auth);
}

export function sendUtterance(
  sessionId: string,
  payload: UtterancePayload,
  auth: AuthConfig,
): Promise<UtteranceResponse> {
  const body = new FormData();
  if (payload.transcript?.trim()) {
    body.append('transcript', payload.transcript.trim());
  }

  const metadata: Record<string, number> = {};
  if (payload.durationMs) {
    metadata.durationMs = payload.durationMs;
  }

  if (Object.keys(metadata).length) {
    body.append('metadata', JSON.stringify(metadata));
  }

  if (payload.audioFile) {
    body.append('audio', payload.audioFile);
  }

  return request(
    '/user-utterance',
    {
      method: 'POST',
      body,
      headers: {
        'X-Session-Id': sessionId,
      },
    },
    auth,
  );
}

export function fetchSummary(sessionId: string, auth: AuthConfig): Promise<SessionSummary> {
  const search = new URLSearchParams({ sessionId });
  return request(`/session-summary?${search.toString()}`, { method: 'GET' }, auth);
}

export function speakWithVoiceAgent(
  payload: VoiceAgentRequest,
  auth: AuthConfig,
): Promise<VoiceAgentResponse> {
  return request('/voice-agent/speak', { method: 'POST', body: JSON.stringify(payload) }, auth);
}

export interface ElevenLabsAgentConfig {
  agentId: string;
  conversationToken: string;
}

export function getElevenLabsAgentConfig(auth: AuthConfig): Promise<ElevenLabsAgentConfig> {
  return request('/elevenlabs/agent-config', { method: 'GET' }, auth);
}

export function sendElevenLabsDialogueTurn(
  payload: ElevenLabsDialogueTurnRequest,
  auth: AuthConfig,
): Promise<ElevenLabsDialogueTurnResponse> {
  const requestId = payload.metadata?.toolCallId as string | undefined;
  const startTime = Date.now();

  console.log('[API] Sending dialogue turn request', {
    requestId,
    endpoint: '/elevenlabs/dialogue-turn',
    transcriptLength: payload.transcript?.length ?? 0,
    sessionId: payload.sessionId,
    userId: payload.userId,
    timestamp: new Date().toISOString(),
  });

  return request<ElevenLabsDialogueTurnResponse>(
    '/elevenlabs/dialogue-turn',
    { method: 'POST', body: JSON.stringify(payload) },
    auth,
  ).then((response) => {
      const duration = Date.now() - startTime;
      console.log('[API] Dialogue turn response received', {
        requestId,
        turnId: response.turnId,
        status: 'success',
        durationMs: duration,
        timestamp: new Date().toISOString(),
      });
      return response;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      console.error('[API] Dialogue turn request failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
        timestamp: new Date().toISOString(),
      });
      throw error;
    });
}
