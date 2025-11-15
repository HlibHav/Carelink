import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

import { config } from '../config.js';

export const toneOptions = [
  'warm_empathic',
  'calm_soothing',
  'supportive_caring',
  'coach_grounded',
  'reflective_thoughtful',
  'cheerful_light',
  'playful_energetic',
  'serious_direct',
] as const;

export type TonePresetName = (typeof toneOptions)[number];

const tonePresets: Record<
  TonePresetName,
  {
    label: string;
    stability: number;
    similarity: number;
    stylePreset: string;
    instruction: string;
  }
> = {
  warm_empathic: {
    label: 'Warm Empathic',
    stability: 0.7,
    similarity: 0.6,
    stylePreset: 'soft',
    instruction: 'Speak gently, warmly, slowly, and with soft pauses.',
  },
  calm_soothing: {
    label: 'Calm / Soothing',
    stability: 0.78,
    similarity: 0.5,
    stylePreset: 'soft',
    instruction: 'Speak slowly and soothingly, easing off at the end of sentences.',
  },
  supportive_caring: {
    label: 'Supportive / Caring',
    stability: 0.6,
    similarity: 0.7,
    stylePreset: 'conversational',
    instruction: 'Speak caringly but confidently, like a supportive friend.',
  },
  coach_grounded: {
    label: 'Coach / Grounded',
    stability: 0.7,
    similarity: 0.9,
    stylePreset: 'serious',
    instruction: 'Speak confidently, calmly, and with clear structure.',
  },
  reflective_thoughtful: {
    label: 'Reflective / Thoughtful',
    stability: 0.55,
    similarity: 0.8,
    stylePreset: 'narration',
    instruction: 'Speak as if gently reflecting on what you heard.',
  },
  cheerful_light: {
    label: 'Cheerful / Light',
    stability: 0.45,
    similarity: 0.55,
    stylePreset: 'excited',
    instruction: 'Keep a light, elevated tone with a soft smile in your voice.',
  },
  playful_energetic: {
    label: 'Playful / Energetic',
    stability: 0.38,
    similarity: 0.7,
    stylePreset: 'excited',
    instruction: 'Play with intonation and add a hint of light humor.',
  },
  serious_direct: {
    label: 'Serious / Direct',
    stability: 0.9,
    similarity: 1,
    stylePreset: 'serious',
    instruction: 'Speak clearly and structured, slower than usual, without extra emotion.',
  },
} as const;

const defaultTone: TonePresetName = 'warm_empathic';

const formatToOutput: Record<string, string> = {
  'audio/mpeg': 'mp3_44100_128',
  'audio/wav': 'wav_44100',
};

const ensureCredentials = () => {
  if (!config.elevenLabs.apiKey || !config.elevenLabs.voiceId) {
    throw new Error('ElevenLabs credentials are not configured.');
  }
};

let elevenLabsClient: ElevenLabsClient | null = null;

const getClient = () => {
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({
      apiKey: () => config.elevenLabs.apiKey,
      baseUrl: () => config.elevenLabs.baseUrl,
    });
  }
  return elevenLabsClient;
};

export interface SynthesizeOptions {
  text: string;
  tone?: TonePresetName;
  format?: keyof typeof formatToOutput;
}

export interface SynthesizeResult {
  audioBase64: string;
  mimeType: string;
  tone: TonePresetName;
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style_preset?: string;
  };
  instruction: string;
}

export const elevenLabsService = {
  tonePresets,

  async synthesizeSpeech({
    text,
    tone = defaultTone,
    format = 'audio/mpeg',
  }: SynthesizeOptions): Promise<SynthesizeResult> {
    ensureCredentials();

    const preset = tonePresets[tone];
    const voiceSettings = {
      stability: preset.stability,
      similarity_boost: preset.similarity,
      style_preset: preset.stylePreset,
    };

    const payload = {
      text: `${preset.instruction}\n\n${text}`,
      model_id: config.elevenLabs.modelId,
      voice_settings: {
        stability: preset.stability,
        similarity_boost: preset.similarity,
        style: 0,
        use_speaker_boost: true,
      },
      style_preset: preset.stylePreset,
      output_format: formatToOutput[format] ?? formatToOutput['audio/mpeg'],
    };

    const stream = await getClient().textToSpeech.convert(
      config.elevenLabs.voiceId,
      {
        ...payload,
        output_format: payload.output_format,
      },
    );

    const reader = stream.getReader();
    const chunks: Buffer[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(Buffer.from(value));
      }
    }

    const buffer = Buffer.concat(chunks);

    return {
      audioBase64: buffer.toString('base64'),
      mimeType: format,
      tone,
      voiceSettings,
      instruction: preset.instruction,
    };
  },
};
