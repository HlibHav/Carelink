import { useMemo, useState } from 'react';

import type { TonePreset, VoiceAgentResponse } from '../lib/types';

const toneOptions: Array<{ value: TonePreset; label: string }> = [
  { value: 'warm_empathic', label: 'Warm Empathic' },
  { value: 'calm_soothing', label: 'Calm / Soothing' },
  { value: 'supportive_caring', label: 'Supportive / Caring' },
  { value: 'coach_grounded', label: 'Coach / Grounded' },
  { value: 'reflective_thoughtful', label: 'Reflective / Thoughtful' },
  { value: 'cheerful_light', label: 'Cheerful / Light' },
  { value: 'playful_energetic', label: 'Playful / Energetic' },
  { value: 'serious_direct', label: 'Serious / Direct' },
];

interface Props {
  disabled: boolean;
  isLoading: boolean;
  onSpeak: (text: string, tone: TonePreset) => Promise<VoiceAgentResponse | null>;
}

export function VoiceAgentPanel({ disabled, isLoading, onSpeak }: Props) {
  const [text, setText] = useState('Let’s try a calming breathing exercise together.');
  const [tone, setTone] = useState<TonePreset>('warm_empathic');
  const [lastResponse, setLastResponse] = useState<VoiceAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioKey = useMemo(() => lastResponse?.audio.dataUri ?? '', [lastResponse]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError('Enter some text before requesting audio.');
      return;
    }
    setError(null);
    const response = await onSpeak(text.trim(), tone);
    if (response) {
      setLastResponse(response);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-midnight-100"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Voice Agent</p>
          <h2 className="text-lg font-semibold text-midnight-900">Generate Speech</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            disabled ? 'bg-midnight-100 text-midnight-500' : 'bg-forest/10 text-forest'
          }`}
        >
          {disabled ? 'Auth required' : 'Ready'}
        </span>
      </div>

      <label className="mt-4 block text-sm font-medium text-midnight-700">
        Tone preset
        <select
          className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          value={tone}
          onChange={(event) => setTone(event.target.value as TonePreset)}
          disabled={disabled}
        >
          {toneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-medium text-midnight-700">
        Text to speak
        <textarea
          className="mt-1 h-32 w-full rounded-3xl border border-midnight-100 bg-midnight-50/70 px-4 py-3 text-sm text-midnight-900 placeholder:text-midnight-400 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
        />
      </label>

      {error ? <p className="mt-2 text-sm text-blush">{error}</p> : null}

      <button
        type="submit"
        disabled={disabled || isLoading}
        className="mt-4 w-full rounded-2xl bg-midnight-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-midnight-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Requesting audio…' : 'Speak with ElevenLabs'}
      </button>

      {lastResponse ? (
        <div className="mt-6 rounded-2xl border border-midnight-100 bg-midnight-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
            Preview
          </p>
          <p className="mt-1 text-sm text-midnight-800">{lastResponse.instruction}</p>
          <audio key={audioKey} controls className="mt-3 w-full">
            <source src={lastResponse.audio.dataUri} type={lastResponse.mimeType} />
          </audio>
        </div>
      ) : null}
    </form>
  );
}
