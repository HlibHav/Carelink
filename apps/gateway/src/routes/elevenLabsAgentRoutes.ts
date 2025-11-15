import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Router } from 'express';
import { z } from 'zod';

import { config } from '../config.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { errors } from '../shared/httpErrors.js';

export const elevenLabsAgentRouter = Router();

const debugLog = (...parts: unknown[]) => {
  if (!config.elevenLabs.debug) {
    return;
  }
  const prefix = `[ElevenLabsAgentRoutes ${new Date().toISOString()}]`;
  console.debug(prefix, ...parts);
};

function getElevenLabsClient(): ElevenLabsClient {
  if (!config.elevenLabs.apiKey) {
    throw errors.serviceUnavailable('ElevenLabs API key is not configured.');
  }

  return new ElevenLabsClient({
    apiKey: () => config.elevenLabs.apiKey,
    baseUrl: () => config.elevenLabs.baseUrl,
  });
}

// GET /api/elevenlabs/agent-config - Get agent configuration (Agent ID + conversation token)
elevenLabsAgentRouter.get(
  '/agent-config',
  asyncHandler(async (req, res) => {
    if (!config.elevenLabs.apiKey) {
      throw errors.serviceUnavailable('ElevenLabs API key is not configured.');
    }

    const agentId = config.elevenLabs.agentId?.trim();
    if (!agentId) {
      throw errors.serviceUnavailable('ElevenLabs Agent ID is not configured.');
    }

    debugLog('Received /agent-config request', {
      method: req.method,
      user: req.header('x-user-id') ?? 'unknown',
      agentId: agentId.slice(0, 8),
    });

    try {
      // Generate conversation token for WebRTC connection using REST API
      const baseUrl = config.elevenLabs.baseUrl.replace('/v1', '');
      const tokenUrl = `${baseUrl}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`;

      debugLog('Requesting conversation token from ElevenLabs', {
        url: tokenUrl.replace(config.elevenLabs.apiKey ?? '', '***'),
      });

      const response = await fetch(tokenUrl, {
        method: 'GET',
        headers: {
          'xi-api-key': config.elevenLabs.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        debugLog('ElevenLabs API error response', {
          status: response.status,
          body: errorText?.slice?.(0, 200),
        });
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
      }

      const tokenData = (await response.json()) as string | { token?: string };
      const conversationToken =
        typeof tokenData === 'string' ? tokenData : tokenData?.token;

      if (!conversationToken) {
        debugLog('Conversation token missing in ElevenLabs response', tokenData);
        throw new Error('Failed to retrieve conversation token from ElevenLabs response');
      }

      debugLog('Successfully retrieved conversation token', {
        tokenLength: conversationToken.length,
      });

      res.json({
        agentId,
        conversationToken,
      });
    } catch (error) {
      debugLog('Failed to get agent configuration', error);
      throw errors.serviceUnavailable(
        error instanceof Error
          ? `Failed to get agent configuration: ${error.message}`
          : 'Unable to get agent configuration from ElevenLabs',
      );
    }
  }),
);
