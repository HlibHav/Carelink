import { randomUUID } from 'node:crypto';

import { elevenLabsService } from '../services/elevenLabsService.js';
import { transcribeAudio } from '../services/sttService.js';
import { errors } from '../shared/httpErrors.js';
import { getMindBehaviorStateSummary } from '../clients/mindBehaviorEngineClient.js';
import { getPhysicalStateSummary } from '../clients/physicalEngineClient.js';
import {
  retrieveDialogueContext,
  saveConversationTurn,
  storeCandidateMemories,
} from '../clients/memoryManagerClient.js';

import { generateCoachReply } from './coachAgent.js';
import { refineEmotionState } from './emotionAgent.js';
import { runListenerAgent } from './listenerAgent.js';
import { planNextTurn } from './plannerAgent.js';
import { determineTone } from './toneAgent.js';
import type { EmotionState, OrchestratorInput, OrchestratorResult } from './types.js';

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
  const [memorySnapshot, physicalState, mindBehaviorState] = await Promise.all([
    retrieveDialogueContext(input.userId, transcript),
    getPhysicalStateSummary(input.userId).catch((error) => {
      console.error('Physical engine unavailable', error);
      return undefined;
    }),
    getMindBehaviorStateSummary(input.userId).catch((error) => {
      console.error('Mind & Behavior engine unavailable', error);
      return undefined;
    }),
  ]);
  const context = {
    profile: memorySnapshot.profile,
    facts: memorySnapshot.facts ?? [],
    goals: memorySnapshot.goals ?? [],
    gratitude: memorySnapshot.gratitude ?? [],
    lastMode: memorySnapshot.lastMode,
    lastEmotion: (memorySnapshot.lastEmotion as EmotionState | null) ?? null,
    physicalState,
    mindBehaviorState,
  };
  const listener = await runListenerAgent(transcript);
  const emotion = await refineEmotionState(listener, context.profile);
  const plan = await planNextTurn({
    emotion,
    profile: context.profile,
    openLoops: context.goals,
    lastMode: context.lastMode,
    physicalStateSummary: context.physicalState,
    mindBehaviorSummary: context.mindBehaviorState,
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

  await saveConversationTurn(input.userId, {
    sessionId: input.sessionId,
    turnId: `${turnId}_user`,
    role: 'user',
    text: transcript,
    emotion,
    metadata: input.metadata,
  });

  await saveConversationTurn(input.userId, {
    sessionId: input.sessionId,
    turnId: `${turnId}_assistant`,
    role: 'assistant',
    text: coach.text,
    emotion,
    mode: plan.mode,
  });

  if (listener.facts?.length) {
    await storeCandidateMemories(
      input.userId,
      'facts',
      listener.facts.map((fact) => ({ text: fact.text, importance: 'medium' })),
    );
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
