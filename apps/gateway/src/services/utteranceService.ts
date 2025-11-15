import { randomUUID } from 'node:crypto';

import { runConversationPipeline } from '../orchestrator/conversationOrchestrator.js';
import type { OrchestratorResult } from '../orchestrator/types.js';
import { sessionStore } from '../stores/sessionStore.js';

interface AcceptUtteranceInput {
  sessionId: string;
  userId: string;
  transcript?: string;
  durationMs?: number;
  audioBuffer?: Buffer;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export const utteranceService = {
  async acceptUtterance(input: AcceptUtteranceInput): Promise<OrchestratorResult> {
    const turnId = `turn_${randomUUID()}`;
    sessionStore.upsertTurn({
      turnId,
      sessionId: input.sessionId,
      transcript: input.transcript,
      durationMs: input.durationMs,
      status: 'processing',
      createdAt: new Date().toISOString(),
    });

    const result = await runConversationPipeline({
      userId: input.userId,
      sessionId: input.sessionId,
      transcript: input.transcript,
      audioBuffer: input.audioBuffer,
      locale: input.locale,
      metadata: input.metadata,
    });

    sessionStore.upsertTurn({
      turnId,
      sessionId: input.sessionId,
      transcript: result.transcript,
      durationMs: input.durationMs,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    return result;
  },
};
