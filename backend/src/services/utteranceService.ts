import { randomUUID } from 'crypto';

import { sessionStore } from '../stores/sessionStore.js';

export const utteranceService = {
  acceptUtterance: ({
    sessionId,
    transcript,
    durationMs,
  }: {
    sessionId: string;
    transcript?: string;
    durationMs?: number;
  }) => {
    const turnId = `turn_${randomUUID()}`;
    const turn = sessionStore.upsertTurn({
      turnId,
      sessionId,
      transcript,
      durationMs,
      status: 'processing',
      createdAt: new Date().toISOString(),
    });

    // In the real system we would enqueue the orchestrator pipeline here.

    return {
      turnId: turn.turnId,
      sessionId: turn.sessionId,
      stream: {
        websocket: `wss://api.lifecompanion.app/ws/conversation?sess=${sessionId}`,
        sse: `https://api.lifecompanion.app/api/turn-stream?turn=${turn.turnId}`,
      },
      estimatedProcessingMs: 4500,
    };
  },
};
