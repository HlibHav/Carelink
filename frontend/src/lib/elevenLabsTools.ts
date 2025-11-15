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

const resolveString = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);

export const createDialogueClientTools = (options: DialogueToolOptions) => {
  if (!options.auth) {
    return undefined;
  }

  const handler = async (parameters: Record<string, unknown> = {}) => {
    const transcript = extractTranscript(parameters);
    if (!transcript) {
      throw new Error('Dialogue orchestrator tool was invoked without a transcript.');
    }

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
      },
    };

    const response = await sendElevenLabsDialogueTurn(payload, options.auth);
    options.onResult?.(response, parameters);
    return response.text;
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
