import OpenAI from 'openai';

import { getOpenAIClient, openAiModels } from './openAIClient.js';

export async function transcribeAudio({
  audioBuffer,
  mimeType = 'audio/webm',
  language,
}: {
  audioBuffer: Buffer;
  mimeType?: string;
  language?: string;
}): Promise<string> {
  const client = getOpenAIClient();
  const filename = `input.${mimeType.split('/')[1] ?? 'webm'}`;

  const file = await OpenAI.toFile(audioBuffer, filename);

  const transcription = (await client.audio.transcriptions.create({
    file,
    model: openAiModels.transcription,
    language,
    response_format: 'text',
  })) as string | { text?: string };

  return typeof transcription === 'string' ? transcription : transcription.text ?? '';
}
