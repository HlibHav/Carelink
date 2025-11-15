import OpenAI from 'openai';

import { config } from '../config.js';

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured for Coach agent');
    }
    cachedClient = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseUrl,
      organization: config.openai.organization,
      project: config.openai.project,
    });
  }
  return cachedClient;
}

export const coachModel = config.openai.model;
