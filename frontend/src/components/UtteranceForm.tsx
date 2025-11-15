import { useMemo, useState } from 'react';

import type { UtterancePayload } from '../lib/types';

interface Props {
  sessionId?: string;
  isLoading: boolean;
  onSubmit: (payload: UtterancePayload) => Promise<void>;
}

export function UtteranceForm({ sessionId, isLoading, onSubmit }: Props) {
  const [transcript, setTranscript] = useState('');
  const [durationMs, setDurationMs] = useState<number | undefined>(undefined);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileKey = useMemo(() => `${audioFile?.name ?? 'no-file'}`, [audioFile?.name]);
  const isDisabled = !sessionId;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId) {
      return;
    }
    if (!transcript.trim() && !audioFile) {
      setError('Provide a transcript or upload an audio clip.');
      return;
    }

    setError(null);
    await onSubmit({
      transcript: transcript.trim() || undefined,
      durationMs,
      audioFile,
    });

    setTranscript('');
    setDurationMs(undefined);
    setAudioFile(null);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-midnight-100"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Send turn</p>
          <h2 className="text-lg font-semibold text-midnight-900">Utterance</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            sessionId ? 'bg-forest/10 text-forest' : 'bg-midnight-100 text-midnight-500'
          }`}
        >
          {sessionId ? 'Session Ready' : 'Start a session first'}
        </span>
      </div>

      <textarea
        className="mt-4 h-32 w-full rounded-3xl border border-midnight-100 bg-midnight-50/70 px-4 py-3 text-sm text-midnight-900 placeholder:text-midnight-400 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
        placeholder="Try “I could use a calming breathing exercise.”"
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        disabled={isDisabled}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-midnight-700">
          Duration (ms)
          <input
            type="number"
            min={0}
            max={40000}
            step={100}
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 shadow-inner focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
            value={durationMs ?? ''}
            onChange={(event) => {
              const value = Number(event.target.value);
              setDurationMs(Number.isNaN(value) ? undefined : value);
            }}
            disabled={isDisabled}
            placeholder="e.g. 3200"
          />
        </label>

        <label className="text-sm font-medium text-midnight-700">
          Audio clip (optional)
          <input
            key={fileKey}
            type="file"
            accept="audio/*"
            className="mt-1 block w-full cursor-pointer rounded-2xl border border-dashed border-midnight-200 bg-white px-3 py-2 text-sm text-midnight-700 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-midnight-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-midnight-800"
            onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
            disabled={isDisabled}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-blush">{error}</p> : null}

      <button
        type="submit"
        disabled={isDisabled || isLoading}
        className="mt-6 w-full rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Sending…' : 'Send Utterance'}
      </button>
    </form>
  );
}
