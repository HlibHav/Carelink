import { randomUUID } from 'node:crypto';

type LlmTraceParams = {
  phase: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  response: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Lightweight structured logging for LLM interactions.
 * Includes prompt/response, optional metadata (user/session), and a trace id.
 */
export function logLlmTrace(params: LlmTraceParams) {
  const payload = {
    type: 'llm_trace',
    traceId: randomUUID(),
    phase: params.phase,
    model: params.model,
    prompt: params.messages,
    response: params.response,
    metadata: params.metadata ?? {},
    timestamp: new Date().toISOString(),
  };

  // Intentionally JSON for easier downstream ingestion
  console.log(JSON.stringify(payload));
}

type StateUpdateParams = {
  phase: string;
  state: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export function logStateUpdate(params: StateUpdateParams) {
  const payload = {
    type: 'state_update',
    traceId: randomUUID(),
    phase: params.phase,
    state: params.state,
    metadata: params.metadata ?? {},
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
}
