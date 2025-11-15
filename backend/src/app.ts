import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { config } from './config.js';
import { conversationRouter } from './routes/conversationRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { voiceAgentRouter } from './routes/voiceAgentRoutes.js';
import { errorHandler } from './shared/errorHandler.js';
import { requireAuth } from './shared/requireAuth.js';

const app = express();

const corsOptions = config.allowedOrigins.length
  ? { origin: config.allowedOrigins }
  : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Root route - no auth required
app.get('/', (req, res) => {
  res.json({
    name: 'LifeCompanion Backend API',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      health: '/healthz',
      api: {
        base: '/api',
        startConversation: 'POST /api/start-conversation',
        userUtterance: 'POST /api/user-utterance',
        sessionSummary: 'GET /api/session-summary?sessionId=<id>',
      },
    },
    documentation: 'See backend/API.md for complete API reference',
  });
});

app.use('/healthz', healthRouter);

// Everything below requires auth headers
app.use(requireAuth);

app.use('/api', conversationRouter);
app.use('/api/voice-agent', voiceAgentRouter);

app.use(errorHandler);

export { app };
