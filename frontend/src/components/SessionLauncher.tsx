import type { SessionFormState } from '../lib/types';

interface Props {
  value: SessionFormState;
  onChange: (next: SessionFormState) => void;
  onLaunch: () => void;
  isLoading: boolean;
  hasSession: boolean;
}

export function SessionLauncher({ value, onChange, onLaunch, isLoading, hasSession }: Props) {
  const update = <K extends keyof SessionFormState>(key: K, nextValue: SessionFormState[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-midnight-100">
      <p className="text-xs uppercase tracking-wide text-midnight-400">Session</p>
      <h2 className="text-lg font-semibold text-midnight-900">Launch Conversation</h2>

      <div className="mt-4 grid gap-4">
        <label className="text-sm font-medium text-midnight-700">
          Locale
          <input
            type="text"
            value={value.locale}
            onChange={(event) => update('locale', event.target.value)}
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 shadow-inner focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
            placeholder="en-US"
          />
        </label>

        <label className="text-sm font-medium text-midnight-700">
          Timezone
          <input
            type="text"
            value={value.timezone}
            onChange={(event) => update('timezone', event.target.value)}
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 shadow-inner focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
            placeholder="America/Los_Angeles"
          />
        </label>

        <label className="text-sm font-medium text-midnight-700">
          Entry Point
          <input
            type="text"
            value={value.entryPoint}
            onChange={(event) => update('entryPoint', event.target.value)}
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 shadow-inner focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
            placeholder="demo-ui"
          />
        </label>

        <label className="text-sm font-medium text-midnight-700">
          Audio Format
          <input
            type="text"
            value={value.audioFormat}
            onChange={(event) => update('audioFormat', event.target.value)}
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 shadow-inner focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
            placeholder="linear16"
          />
        </label>

        <div className="flex items-center justify-between rounded-2xl border border-midnight-100 bg-midnight-50/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-midnight-900">Text Support</p>
            <p className="text-xs text-midnight-500">Allow transcript fallback for demo.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={value.supportsText}
              onChange={(event) => update('supportsText', event.target.checked)}
            />
            <span className="h-6 w-10 rounded-full bg-midnight-200 transition peer-checked:bg-forest peer-focus:outline peer-focus:outline-2 peer-focus:outline-offset-2 peer-focus:outline-midnight-300">
              <span className="ml-1 mt-1 block h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4"></span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-midnight-100 bg-midnight-50/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-midnight-900">Proactive Greeting</p>
            <p className="text-xs text-midnight-500">Let agent open with an icebreaker.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={value.wantsProactiveGreeting}
              onChange={(event) => update('wantsProactiveGreeting', event.target.checked)}
            />
            <span className="h-6 w-10 rounded-full bg-midnight-200 transition peer-checked:bg-forest peer-focus:outline peer-focus:outline-2 peer-focus:outline-offset-2 peer-focus:outline-midnight-300">
              <span className="ml-1 mt-1 block h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4"></span>
            </span>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={onLaunch}
        disabled={isLoading}
        className="mt-6 w-full rounded-2xl bg-midnight-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-midnight-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Starting...' : hasSession ? 'Restart Session' : 'Start Conversation'}
      </button>
    </div>
  );
}
