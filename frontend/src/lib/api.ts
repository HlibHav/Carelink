import type {
  AuthConfig,
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
