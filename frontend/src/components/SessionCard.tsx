import type { StartConversationResponse } from '../lib/types';

interface Props {
  session: StartConversationResponse | null;
}

export function SessionCard({ session }: Props) {
  if (!session) {
    return (
      <div className="rounded-3xl border border-dashed border-midnight-200 bg-white/70 p-6 text-center shadow-sm">
        <p className="text-sm text-midnight-500">
          Start a conversation to receive a session ID, recommended icebreakers, and upload URLs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-midnight-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Active Session</p>
          <h2 className="text-2xl font-semibold text-midnight-900">{session.sessionId}</h2>
          <p className="text-sm text-midnight-500">
            Expires {new Date(session.expiresAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
          {session.shouldAgentSpeakFirst ? 'Greeting queued' : 'Awaiting user'}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-midnight-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
            Streaming Targets
          </p>
          <p className="mt-1 text-sm text-midnight-800">WebSocket</p>
          <code className="mt-2 block truncate rounded-xl bg-white/70 p-2 text-xs text-midnight-600">
            {session.websocketUrl}
          </code>
          <p className="mt-3 text-sm text-midnight-800">Upload URL</p>
          <code className="mt-2 block truncate rounded-xl bg-white/70 p-2 text-xs text-midnight-600">
            {session.uploadUrl}
          </code>
        </div>

        <div className="rounded-2xl bg-midnight-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
            Suggested Openers
          </p>
          <ul className="mt-3 space-y-2 text-sm text-midnight-800">
            {session.iceBreakers.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-blush"></span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
