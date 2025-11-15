import type { SessionSummary } from '../lib/types';

interface Props {
  summary: SessionSummary | null;
  sessionId?: string;
  isLoading: boolean;
  onRefresh: () => void;
}

const trendCopy: Record<SessionSummary['moodTrend'], { label: string; badge: string }> = {
  improving: { label: 'Mood improving', badge: 'bg-forest/10 text-forest' },
  stable: { label: 'Mood stable', badge: 'bg-midnight-100 text-midnight-700' },
  declining: { label: 'Mood declining', badge: 'bg-blush/10 text-blush' },
};

export function SummaryPanel({ summary, sessionId, isLoading, onRefresh }: Props) {
  return (
    <div className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-midnight-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Insights</p>
          <h2 className="text-lg font-semibold text-midnight-900">Session Summary</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={!sessionId || isLoading}
          className="rounded-full border border-midnight-200 px-4 py-2 text-xs font-semibold text-midnight-700 transition hover:border-midnight-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {!summary ? (
        <p className="mt-8 text-sm text-midnight-500">
          Launch a session and press refresh to fetch the orchestrator’s synthesized summary for your
          demo.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trendCopy[summary.moodTrend].badge}`}>
              {trendCopy[summary.moodTrend].label}
            </span>
            <p className="text-xs text-midnight-500">
              {new Date(summary.startedAt).toLocaleTimeString()} –{' '}
              {summary.endedAt ? new Date(summary.endedAt).toLocaleTimeString() : 'Live'}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
              Highlights
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-sm text-midnight-800">
              {summary.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-midnight-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
                Goals
              </p>
              <ul className="mt-3 space-y-2 text-sm text-midnight-800">
                {summary.capturedGoals.length === 0 ? (
                  <li className="text-midnight-500">No goals captured this session.</li>
                ) : (
                  summary.capturedGoals.map((goal) => (
                    <li key={goal.goalId} className="flex items-center justify-between">
                      <span>{goal.text}</span>
                      <span
                        className={`text-xs font-semibold ${
                          goal.status === 'done' ? 'text-forest' : 'text-midnight-500'
                        }`}
                      >
                        {goal.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-2xl bg-midnight-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
                Gratitude
              </p>
              <ul className="mt-3 space-y-2 text-sm text-midnight-800">
                {summary.gratitudeEntries.length === 0 ? (
                  <li className="text-midnight-500">No entries logged.</li>
                ) : (
                  summary.gratitudeEntries.map((entry) => (
                    <li key={entry.entryId} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-blush"></span>
                      {entry.text}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
