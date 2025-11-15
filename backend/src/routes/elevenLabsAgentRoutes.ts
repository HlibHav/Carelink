import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Router } from 'express';
import { z } from 'zod';

import { config } from '../config.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { errors } from '../shared/httpErrors.js';

export const elevenLabsAgentRouter = Router();

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

    try {
      // Generate conversation token for WebRTC connection using REST API
      const baseUrl = config.elevenLabs.baseUrl.replace('/v1', '');
      const tokenUrl = `${baseUrl}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`;
      
      const response = await fetch(tokenUrl, {
        method: 'GET',
        headers: {
          'xi-api-key': config.elevenLabs.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
      }

      const tokenData = (await response.json()) as string | { token?: string };
      const conversationToken =
        typeof tokenData === 'string' ? tokenData : tokenData?.token;

      if (!conversationToken) {
        throw new Error('Failed to retrieve conversation token from ElevenLabs response');
      }

      res.json({
        agentId,
        conversationToken,
      });
    } catch (error) {
      throw errors.serviceUnavailable(
        error instanceof Error
          ? `Failed to get agent configuration: ${error.message}`
          : 'Unable to get agent configuration from ElevenLabs',
      );
    }
  }),
);
