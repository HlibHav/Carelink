import { randomBytes } from 'node:crypto';

import { context, trace, SpanStatusCode } from '@opentelemetry/api';

import { config } from '../config.js';

// OpenTelemetry semantic conventions for LLM spans
// See: https://opentelemetry.io/docs/specs/semconv/gen-ai/
const LLM_ATTRS = {
  REQUEST_MODEL: 'gen_ai.request.model',
  REQUEST_PROMPT: 'gen_ai.request.prompt',
  REQUEST_SYSTEM: 'gen_ai.request.system',
  REQUEST_USER: 'gen_ai.request.user',
  RESPONSE_CONTENT: 'gen_ai.response.content',
  RESPONSE_FINISH_REASON: 'gen_ai.response.finish_reason',
  USAGE_PROMPT_TOKENS: 'gen_ai.usage.prompt_tokens',
  USAGE_COMPLETION_TOKENS: 'gen_ai.usage.completion_tokens',
  USAGE_TOTAL_TOKENS: 'gen_ai.usage.total_tokens',
} as const;

export interface PhoenixSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: string;
  endTime: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

async function postSpan(span: PhoenixSpan): Promise<void> {
  if (!config.observability.phoenixEndpoint) {
    return;
  }

  // Phoenix v12+ ingests via OTLP (/v1/traces). We already emit OTEL spans via @arizeai/phoenix-otel,
  // so avoid hitting deprecated /api/spans (returns 405) and just log locally.
  console.warn(
    `[Phoenix] Skipping JSON span ${span.name}; rely on OTEL exporter (@arizeai/phoenix-otel) to send to ${config.observability.phoenixEndpoint}/v1/traces`,
  );
}

export async function logSpan(span: PhoenixSpan): Promise<void> {
  await postSpan(span);
}

const tracer = trace.getTracer('dialogue-agent');

// Track LLM spans to prevent captureSpan from overriding their input/output
const llmSpans = new WeakSet<trace.Span>();

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function normalizeTraceId(id: string): string {
  const hex = id.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length === 32) return hex;
  if (hex.length > 32) return hex.slice(0, 32);
  // pad with zeros if too short
  return (hex + '0'.repeat(32)).slice(0, 32);
}

function normalizeSpanId(id: string): string {
  const hex = id.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length === 16) return hex;
  if (hex.length > 16) return hex.slice(0, 16);
  return (hex + '0'.repeat(16)).slice(0, 16);
}

function generateSpanId(): string {
  return toHex(randomBytes(8));
}

type CaptureSpanOptions = {
  traceId: string;
  parentSpanId?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Helper function to set LLM attributes on a span using OpenTelemetry semantic conventions.
 * This ensures system prompts appear in inputs and LLM responses appear in outputs in Phoenix.
 */
export function setLlmSpanAttributes(
  span: trace.Span,
  messages: Array<{ role: string; content: unknown }>,
  completion?: {
    model?: string;
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  },
): void {
  // Mark this as an LLM span so captureSpan knows not to override input/output
  llmSpans.add(span);
  span.setAttribute('_is_llm_span', true);
  
  // Extract system and user prompts
  const systemMessage = messages.find((m) => m.role === 'system');
  const userMessage = messages.find((m) => m.role === 'user');
  
  // Set system prompt in input attributes
  if (systemMessage?.content) {
    const systemContent = typeof systemMessage.content === 'string' 
      ? systemMessage.content 
      : JSON.stringify(systemMessage.content);
    span.setAttribute(LLM_ATTRS.REQUEST_SYSTEM, systemContent);
    // Also set as input for Phoenix visibility
    span.setAttribute('input.system_prompt', systemContent);
  }
  
  // Set user prompt in input attributes
  if (userMessage?.content) {
    const userContent = typeof userMessage.content === 'string'
      ? userMessage.content
      : JSON.stringify(userMessage.content);
    span.setAttribute(LLM_ATTRS.REQUEST_USER, userContent);
    span.setAttribute('input.user_prompt', userContent);
  }
  
  // Set full prompt as input
  span.setAttribute(LLM_ATTRS.REQUEST_PROMPT, JSON.stringify(messages));
  span.setAttribute('input.messages', JSON.stringify(messages));
  
  // Set main 'input' attribute for Phoenix table view
  // Phoenix uses this to populate the Input column in the table
  // Use a concise format: system prompt (truncated if too long) + user prompt
  let inputForTable: string;
  if (systemMessage?.content && userMessage?.content) {
    const systemStr = typeof systemMessage.content === 'string' 
      ? systemMessage.content 
      : JSON.stringify(systemMessage.content);
    const userStr = typeof userMessage.content === 'string'
      ? userMessage.content
      : JSON.stringify(userMessage.content);
    // Truncate system prompt if too long (keep first 500 chars + "...")
    const systemDisplay = systemStr.length > 500 
      ? systemStr.substring(0, 500) + '...' 
      : systemStr;
    inputForTable = `[System]\n${systemDisplay}\n\n[User]\n${userStr}`;
  } else {
    inputForTable = JSON.stringify(messages);
  }
  span.setAttribute('input', inputForTable);
  // Also add as event for compatibility with tools that read from events
  span.addEvent('input', { value: inputForTable });
  
  // Set model if available
  if (completion?.model) {
    span.setAttribute(LLM_ATTRS.REQUEST_MODEL, completion.model);
  }
  
  // Set response content in output attributes
  const responseContent = completion?.choices?.[0]?.message?.content;
  if (responseContent) {
    span.setAttribute(LLM_ATTRS.RESPONSE_CONTENT, responseContent);
    span.setAttribute('output.content', responseContent);
    
    // Set main 'output' attribute for Phoenix table view
    // Phoenix uses this to populate the Output column in the table
    span.setAttribute('output', responseContent);
    // Also add as event for compatibility with tools that read from events
    span.addEvent('output', { value: responseContent });
  }
  
  // Set finish reason
  if (completion?.choices?.[0]?.finish_reason) {
    span.setAttribute(LLM_ATTRS.RESPONSE_FINISH_REASON, completion.choices[0].finish_reason);
  }
  
  // Set token usage
  if (completion?.usage) {
    if (completion.usage.prompt_tokens !== undefined) {
      span.setAttribute(LLM_ATTRS.USAGE_PROMPT_TOKENS, completion.usage.prompt_tokens);
    }
    if (completion.usage.completion_tokens !== undefined) {
      span.setAttribute(LLM_ATTRS.USAGE_COMPLETION_TOKENS, completion.usage.completion_tokens);
    }
    if (completion.usage.total_tokens !== undefined) {
      span.setAttribute(LLM_ATTRS.USAGE_TOTAL_TOKENS, completion.usage.total_tokens);
    }
  }
  
  // Set full response as output for Phoenix visibility
  if (completion) {
    span.setAttribute('output.response', JSON.stringify(completion));
  }
}

export async function captureSpan<T>(
  name: string,
  options: CaptureSpanOptions,
  fn: () => Promise<T>,
): Promise<{ result: T; spanId: string }> {
  const traceId = normalizeTraceId(options.traceId);
  const parentSpanId = options.parentSpanId
    ? normalizeSpanId(options.parentSpanId)
    : generateSpanId();

  const parentContext = trace.setSpanContext(context.active(), {
    traceId,
    spanId: parentSpanId,
    traceFlags: 1,
    isRemote: false,
  });

  const span = tracer.startSpan(name, undefined, parentContext);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), async () => {
      // Set input attributes
      if (options.input !== undefined) {
        const inputStr = typeof options.input === 'string' 
          ? options.input 
          : JSON.stringify(options.input);
        span.setAttribute('input', inputStr);
        span.addEvent('input', { input: inputStr });
      }
      
      // Set metadata attributes
      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          span.setAttribute(`metadata.${key}`, typeof value === 'string' ? value : JSON.stringify(value));
        }
      }
      
      const inner = await fn();
      
      // Set output attributes (only if this is NOT an LLM span)
      // LLM spans will have set 'output' via setLlmSpanAttributes
      // We use WeakSet to track LLM spans since we can't read attributes back
      if (inner !== undefined && !llmSpans.has(span)) {
        const outputStr = typeof inner === 'string'
          ? inner
          : JSON.stringify(inner);
        span.setAttribute('output', outputStr);
        span.addEvent('output', { output: outputStr });
      }
      // For LLM spans, setLlmSpanAttributes has already set 'output' with the LLM response content
      // Don't override it with the parsed function result
      
      // Always set status to OK on success
      span.setStatus({ code: SpanStatusCode.OK });
      return inner;
    });
    return { result, spanId: span.spanContext().spanId };
  } catch (error) {
    span.recordException(error as Error);
    // Always set status to ERROR on failure
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    // Status is always set in try (OK) or catch (ERROR) blocks above
    span.end();
  }
}
