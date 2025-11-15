import type { ConversationMessage } from '../lib/types';

interface Props {
  messages: ConversationMessage[];
}

const roleCopy: Record<ConversationMessage['role'], string> = {
  user: 'You',
  coach: 'LifeCompanion',
  system: 'System',
};

export function ConversationTimeline({ messages }: Props) {
  return (
    <div className="rounded-3xl bg-white/90 p-6 shadow-inner ring-1 ring-midnight-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Timeline</p>
          <h2 className="text-lg font-semibold text-midnight-900">Conversation</h2>
        </div>
        <span className="text-xs font-medium text-midnight-500">
          {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      {messages.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-midnight-200 bg-white/60 p-6 text-center text-sm text-midnight-500">
          Your turns and system acknowledgements will show up here once you start chatting.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-3xl border px-5 py-4 shadow-sm ${
                message.role === 'user'
                  ? 'border-forest/30 bg-forest/5'
                  : message.role === 'coach'
                    ? 'border-midnight-200 bg-midnight-50/70'
                    : 'border-blush/30 bg-blush/10'
              }`}
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-midnight-500">
                <span>{roleCopy[message.role]}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-midnight-900">{message.text}</p>
              {message.meta ? (
                <p className="mt-2 text-xs text-midnight-500">{message.meta}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
