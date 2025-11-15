import { randomUUID } from 'node:crypto';

import { elevenLabsService } from '../services/elevenLabsService.js';
import { memoryService } from '../services/memoryService.js';
import { transcribeAudio } from '../services/sttService.js';
import { errors } from '../shared/httpErrors.js';

import { generateCoachReply } from './coachAgent.js';
import { refineEmotionState } from './emotionAgent.js';
import { runListenerAgent } from './listenerAgent.js';
import { planNextTurn } from './plannerAgent.js';
import { determineTone } from './toneAgent.js';
import type { OrchestratorInput, OrchestratorResult } from './types.js';

export async function runConversationPipeline(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  let transcript = input.transcript?.trim() ?? '';

  if (!transcript && input.audioBuffer) {
    transcript = await transcribeAudio({
      audioBuffer: input.audioBuffer,
      mimeType: (input.metadata?.mimeType as string) ?? 'audio/webm',
      language: input.locale,
    });
  }

  if (!transcript) {
    throw errors.badRequest('Either audio or transcript must be provided.');
  }

  const turnId = `turn_${randomUUID()}`;
  const context = await memoryService.getConversationContext(input.userId, transcript);
  const listener = await runListenerAgent(transcript);
  const emotion = await refineEmotionState(listener, context.profile);
  const plan = await planNextTurn({
    emotion,
    profile: context.profile,
    openLoops: context.goals,
    lastMode: context.lastMode,
  });
  const coach = await generateCoachReply({
    listener,
    emotion,
    plan,
    context,
  });

  const tone = determineTone(emotion, plan);
  const tts = await elevenLabsService.synthesizeSpeech({
    text: coach.text,
    tone,
  });

  await memoryService.saveConversationTurn({
    userId: input.userId,
    sessionId: input.sessionId,
    turnId: `${turnId}_user`,
    role: 'user',
    text: transcript,
    metadata: input.metadata,
    emotion,
  });

  await memoryService.saveConversationTurn({
    userId: input.userId,
    sessionId: input.sessionId,
    turnId: `${turnId}_assistant`,
    role: 'assistant',
    text: coach.text,
    emotion,
    mode: plan.mode,
  });

  if (listener.facts?.length) {
    await memoryService.saveMemories(input.userId, 'facts', listener.facts);
  }

  return {
    turnId,
    transcript,
    listener,
    emotion,
    plan,
    coach,
    tone,
    audioBase64: tts.audioBase64,
    mimeType: tts.mimeType,
  };
}
