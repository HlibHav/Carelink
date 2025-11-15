import { randomUUID } from 'node:crypto';

import { runDialogueAgentTurn } from './dialogueAgentClient.js';
import { elevenLabsService } from './elevenLabsService.js';
import type { TonePresetName } from './elevenLabsService.js';
import { transcribeAudio } from './sttService.js';
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

export interface ConversationResult {
  turnId: string;
  transcript: string;
  listener: Record<string, unknown>;
  emotion: Record<string, unknown>;
  plan: Record<string, unknown>;
  coach: {
    text: string;
    actions?: Array<{ type: string; text: string }>;
    reasoning?: string;
  };
  tone: string;
  audioBase64?: string;
  mimeType?: string;
}

async function resolveTranscript(
  transcript: string | undefined,
  audioBuffer?: Buffer,
  metadata?: Record<string, unknown>,
  locale?: string,
): Promise<string> {
  const trimmed = transcript?.trim() ?? '';
  if (trimmed) {
    return trimmed;
  }

  if (audioBuffer) {
    return transcribeAudio({
      audioBuffer,
      mimeType: (metadata?.mimeType as string) ?? 'audio/webm',
      language: locale,
    });
  }

  throw new Error('Either transcript or audio must be provided');
}

export const utteranceService = {
  async acceptUtterance(input: AcceptUtteranceInput): Promise<ConversationResult> {
    const turnId = `turn_${randomUUID()}`;
    sessionStore.upsertTurn({
      turnId,
      sessionId: input.sessionId,
      transcript: input.transcript,
      durationMs: input.durationMs,
      status: 'processing',
      createdAt: new Date().toISOString(),
    });

    const transcript = await resolveTranscript(
      input.transcript,
      input.audioBuffer,
      input.metadata,
      input.locale,
    );

    const dialogueResult = await runDialogueAgentTurn({
      userId: input.userId,
      sessionId: input.sessionId,
      transcript,
      metadata: input.metadata,
    });

    const tone = (dialogueResult.tone as TonePresetName) ?? 'warm_empathic';
    const tts = await elevenLabsService.synthesizeSpeech({
      text: dialogueResult.coach.text,
      tone,
    });

    sessionStore.upsertTurn({
      turnId,
      sessionId: input.sessionId,
      transcript,
      durationMs: input.durationMs,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    return {
      ...dialogueResult,
      transcript,
      audioBase64: tts.audioBase64,
      mimeType: tts.mimeType,
    };
  },
};
