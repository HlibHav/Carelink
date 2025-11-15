import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { sessionService } from '../services/sessionService.js';
import { summaryService } from '../services/summaryService.js';
import { utteranceService } from '../services/utteranceService.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { errors } from '../shared/httpErrors.js';
import { sessionStore } from '../stores/sessionStore.js';

export const conversationRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const startConversationSchema = z.object({
  locale: z.string().min(2).default('uk-UA'),
  capabilities: z.object({
    audioFormat: z.string(),
    supportsText: z.boolean().default(true),
    wantsProactiveGreeting: z.boolean().default(true),
  }),
  context: z
    .object({
      timezone: z.string().optional(),
      entryPoint: z.string().optional(),
    })
    .default({}),
});

conversationRouter.post(
  '/start-conversation',
  asyncHandler((req, res) => {
    const userId = req.userId!;
    const deviceId = req.deviceId!;

    const parsed = startConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw errors.badRequest('Invalid request body', { issues: parsed.error.issues });
    }

    const existing = sessionStore.findActiveSession(userId, deviceId);
    if (existing) {
      throw errors.sessionConflict(existing.id);
    }

    const payload = sessionService.startSession({
      userId,
      deviceId,
      locale: parsed.data.locale,
      capabilities: parsed.data.capabilities,
      context: parsed.data.context,
    });

    res.status(201).json(payload);
  }),
);

const userUtteranceSchema = z.object({
  transcript: z.string().min(1).optional(),
  metadata: z
    .object({
      durationMs: z.number().int().positive().max(40_000).optional(),
      sampleRate: z.number().int().positive().optional(),
    })
    .optional(),
});

conversationRouter.post(
  '/user-utterance',
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    const sessionId = req.get('x-session-id');
    if (!sessionId) {
      throw errors.badRequest('Missing X-Session-Id header');
    }

    const session = sessionStore.getSession(sessionId);
    if (!session) {
      throw errors.sessionNotFound(sessionId);
    }

    let metadataPayload: unknown;
    if (typeof req.body.metadata === 'string') {
      try {
        metadataPayload = JSON.parse(req.body.metadata);
      } catch {
        throw errors.badRequest('metadata field must be JSON parseable');
      }
    } else {
      metadataPayload = req.body.metadata;
    }

    const bodyInput = {
      transcript:
        typeof req.body.transcript === 'string' ? req.body.transcript : undefined,
      metadata: metadataPayload,
    };

    const parsed = userUtteranceSchema.safeParse(bodyInput);
    if (!parsed.success) {
      throw errors.badRequest('Invalid payload', { issues: parsed.error.issues });
    }

    if (parsed.data.metadata?.durationMs && parsed.data.metadata.durationMs > 40_000) {
      throw errors.badRequest('Audio duration exceeds 40 seconds');
    }

    if (!req.file && !parsed.data.transcript) {
      throw errors.badRequest('Either audio or transcript must be provided.');
    }

    const response = await utteranceService.acceptUtterance({
      sessionId,
      userId: req.userId!,
      transcript: parsed.data.transcript,
      durationMs: parsed.data.metadata?.durationMs,
      audioBuffer: req.file?.buffer,
      locale: session.locale,
      metadata: {
        ...parsed.data.metadata,
        mimeType: req.file?.mimetype,
      },
    });

    res.status(200).json(response);
  }),
);

conversationRouter.get(
  '/session-summary',
  asyncHandler((req, res) => {
    const sessionId = req.query.sessionId;
    if (typeof sessionId !== 'string') {
      throw errors.badRequest('sessionId query param is required');
    }

    const summary = summaryService.getSummary(sessionId);
    res.json(summary);
  }),
);
