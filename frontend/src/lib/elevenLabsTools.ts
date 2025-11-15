import { sendElevenLabsDialogueTurn } from './api.js';
import type {
  AuthConfig,
  ElevenLabsDialogueTurnRequest,
  ElevenLabsDialogueTurnResponse,
} from './types.js';

export const DIALOGUE_TOOL_NAME = 'carelink_dialogue_orchestrator';

interface DialogueToolOptions {
  auth?: AuthConfig;
  defaultUserId?: string;
  onBeforeCall?: (parameters: Record<string, unknown>) => void;
  onResult?: (
    result: ElevenLabsDialogueTurnResponse,
    parameters: Record<string, unknown>,
  ) => void;
  onError?: (message: string, error: unknown, parameters: Record<string, unknown>) => void;
}

const extractTranscript = (parameters: Record<string, unknown>) => {
  const candidate =
    typeof parameters?.input === 'string'
      ? parameters.input
      : typeof parameters?.text === 'string'
        ? parameters.text
        : typeof parameters?.message === 'string'
          ? parameters.message
          : typeof parameters?.transcript === 'string'
            ? parameters.transcript
            : typeof parameters?.prompt === 'string'
              ? parameters.prompt
              : '';
  return candidate.trim();
};

const resolveString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // Don't treat "None", "null", "undefined" as valid values
  if (!trimmed || trimmed === 'None' || trimmed === 'null' || trimmed === 'undefined') {
    return undefined;
  }
  return trimmed;
};

export const createDialogueClientTools = (options: DialogueToolOptions) => {
  if (!options.auth) {
    return undefined;
  }

  const auth = options.auth; // Type narrowing for TypeScript

  const handler = async (parameters: Record<string, unknown> = {}) => {
    const transcript = extractTranscript(parameters);
    if (!transcript) {
      throw new Error('Dialogue orchestrator tool was invoked without a transcript.');
    }

    const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();

    console.log('[ElevenLabs Client Tool] Tool call initiated', {
      toolCallId,
      toolName: DIALOGUE_TOOL_NAME,
      transcript: transcript.slice(0, 100),
      parameters: {
        session_id: resolveString(parameters.session_id),
        user_id: resolveString(parameters.user_id),
        locale: resolveString(parameters.locale),
      },
      timestamp: new Date().toISOString(),
    });

    options.onBeforeCall?.(parameters);

    const payload: ElevenLabsDialogueTurnRequest = {
      transcript,
      sessionId:
        resolveString(parameters.session_id) ??
        resolveString(parameters.conversation_id) ??
        resolveString(parameters.sessionId) ??
        resolveString(parameters.conversationId),
      userId: resolveString(parameters.user_id) ?? resolveString(parameters.userId) ?? options.defaultUserId,
      metadata: {
        elevenLabsToolCall: parameters,
        toolCallId,
      },
    };

    try {
      const response = await sendElevenLabsDialogueTurn(payload, auth);
      const duration = Date.now() - startTime;

      console.log('[ElevenLabs Client Tool] Backend response received', {
        toolCallId,
        turnId: response.turnId,
        durationMs: duration,
        responseLength: response.text?.length ?? 0,
        emotion: response.emotion?.primary,
        mode: response.plan?.mode,
        timestamp: new Date().toISOString(),
      });

      options.onResult?.(response, parameters);
      return response.text;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('[ElevenLabs Client Tool] Backend request failed', {
        toolCallId,
        error: errorMessage,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  };

  return {
    clientTools: {
      [DIALOGUE_TOOL_NAME]: async (parameters: Record<string, unknown> = {}) => {
        try {
          return await handler(parameters);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Dialogue orchestrator request failed.';
          options.onError?.(message, error, parameters);
          return `Dialogue orchestrator error: ${message}`;
        }
      },
    },
  };
};
