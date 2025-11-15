import { getOpenAIClient, openAiModels } from './openAIClient.js';

export async function createEmbedding(input: string): Promise<number[]> {
  const cleaned = input.trim();
  if (!cleaned) {
    return [];
  }

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: openAiModels.embedding,
    input: cleaned,
  });

  const vector = response.data[0]?.embedding;
  if (!vector) {
    throw new Error('Embedding generation failed');
  }

  return vector;
}
