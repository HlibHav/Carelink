import { Router } from 'express';
import { z } from 'zod';

import { config } from '../config.js';
import { elevenLabsService, toneOptions } from '../services/elevenLabsService.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { errors } from '../shared/httpErrors.js';

const toneEnum = z.enum(toneOptions);

const speakSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  tone: toneEnum.default('warm_empathic'),
  format: z.enum(['audio/mpeg', 'audio/wav']).default('audio/mpeg'),
});

export const voiceAgentRouter = Router();

voiceAgentRouter.post(
  '/speak',
  asyncHandler(async (req, res) => {
    const parsed = speakSchema.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest('Invalid voice agent payload', {
        issues: parsed.error.issues,
      });
    }

    if (!config.elevenLabs.apiKey || !config.elevenLabs.voiceId) {
      throw errors.serviceUnavailable('ElevenLabs credentials are not configured on the server.');
    }

    try {
      const result = await elevenLabsService.synthesizeSpeech(parsed.data);

      res.json({
        tone: result.tone,
        mimeType: result.mimeType,
        instruction: result.instruction,
        voiceSettings: result.voiceSettings,
        audio: {
          base64: result.audioBase64,
          dataUri: `data:${result.mimeType};base64,${result.audioBase64}`,
        },
      });
    } catch (error) {
      throw errors.serviceUnavailable(
        error instanceof Error ? error.message : 'Unable to reach ElevenLabs',
      );
    }
  }),
);
