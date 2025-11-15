import { useEffect, useMemo, useState } from 'react';

import { AuthPanel } from './components/AuthPanel';
import { ConversationTimeline } from './components/ConversationTimeline';
import { SessionCard } from './components/SessionCard';
import { SessionLauncher } from './components/SessionLauncher';
import { SummaryPanel } from './components/SummaryPanel';
import { UtteranceForm } from './components/UtteranceForm';
import { VoiceAgentPanel } from './components/VoiceAgentPanel';
import { EmbeddedAgentPanel } from './components/EmbeddedAgentPanel';
import { VoiceOrbView } from './components/VoiceOrbView';
import { fetchSummary, sendUtterance, speakWithVoiceAgent, startConversation } from './lib/api';
import type {
  AuthConfig,
  ConversationMessage,
  SessionFormState,
  SessionSummary,
  StartConversationResponse,
  UtterancePayload,
  VoiceAgentRequest,
  VoiceAgentResponse,
} from './lib/types';

const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

const defaultAuth: AuthConfig = {
  token: 'demo-token',
  userId: 'user_demo',
  deviceId: 'device_web',
  clientVersion: 'web-0.1',
};

const defaultSessionForm: SessionFormState = {
  locale: 'en-US',
  timezone: resolvedTimezone,
  entryPoint: 'demo-ui',
  audioFormat: 'linear16',
  supportsText: true,
  wantsProactiveGreeting: true,
};

function App() {
  const [auth, setAuth] = useState<AuthConfig>(defaultAuth);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(defaultSessionForm);
  const [session, setSession] = useState<StartConversationResponse | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pushMessage = (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
    const fallbackId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallbackId;

    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const conversationDisabled = useMemo(() => !session, [session]);
  useEffect(() => {
    if (!statusMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const handleStartConversation = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const payload = {
        locale: sessionForm.locale,
        capabilities: {
          audioFormat: sessionForm.audioFormat,
          supportsText: sessionForm.supportsText,
          wantsProactiveGreeting: sessionForm.wantsProactiveGreeting,
        },
        context: {
          timezone: sessionForm.timezone,
          entryPoint: sessionForm.entryPoint,
        },
      };

      const newSession = await startConversation(payload, auth);
      setSession(newSession);
      setSummary(null);
      setMessages([]);
      pushMessage({
        role: 'system',
        text: `Session ${newSession.sessionId} is live. ${
          newSession.shouldAgentSpeakFirst
            ? 'Agent will greet first.'
            : 'Waiting for your first utterance.'
        }`,
      });
      setStatusMessage('Session created successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    } finally {
      setIsStarting(false);
    }
  };

  const handleUtterance = async (payload: UtterancePayload) => {
    if (!session) return;
    setIsSending(true);
    setError(null);

    if (payload.transcript) {
      pushMessage({
        role: 'user',
        text: payload.transcript,
      });
    }

    try {
      const response = await sendUtterance(session.sessionId, payload, auth);
      pushMessage({
        role: 'coach',
        text: 'Turn accepted and queued for orchestration.',
        meta: `turnId ${response.turnId} · ETA ${Math.round(response.estimatedProcessingMs / 1000)}s`,
      });
      setStatusMessage('Utterance delivered to backend.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send utterance');
    } finally {
      setIsSending(false);
    }
  };

  const handleRefreshSummary = async () => {
    if (!session) return;
    setIsLoadingSummary(true);
    setError(null);
    try {
      const data = await fetchSummary(session.sessionId, auth);
      setSummary(data);
      setStatusMessage('Summary refreshed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch summary');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSpeakWithVoiceAgent = async (
    text: string,
    tone: VoiceAgentRequest['tone'],
  ): Promise<VoiceAgentResponse | null> => {
    setIsSpeaking(true);
    setError(null);
    try {
      const response = await speakWithVoiceAgent({ text, tone }, auth);
      setStatusMessage('Voice agent responded.');
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach voice agent');
      return null;
    } finally {
      setIsSpeaking(false);
    }
  };

  const showVoiceOrb =
    typeof window !== 'undefined' &&
    (() => {
      const normalized =
        window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
      return normalized === '/convai';
    })();
  if (showVoiceOrb) {
    return <VoiceOrbView auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand via-white to-midnight-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-12">
        <header className="relative overflow-hidden rounded-[2.5rem] bg-midnight-900 px-8 py-10 text-white shadow-2xl">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/70">LifeCompanion</p>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
                Voice-First Companion Playground
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/80">
                Launch authenticated sessions, send test utterances, and preview summary insights
                without leaving your browser.
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-6 py-4 text-center backdrop-blur">
              <p className="text-sm uppercase tracking-wide text-white/70">API Base</p>
              <p className="mt-1 text-lg font-semibold">
                {import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-0 opacity-40">
            <div className="h-full w-72 rounded-full bg-gradient-to-b from-blush to-forest blur-3xl" />
          </div>
        </header>

        {(error || statusMessage) && (
          <div className="mt-6 space-y-2">
            {error ? (
              <div className="rounded-3xl border border-blush/40 bg-blush/10 px-4 py-3 text-sm text-blush">
                {error}
              </div>
            ) : null}
            {statusMessage ? (
              <div className="rounded-3xl border border-forest/30 bg-forest/10 px-4 py-3 text-sm text-forest">
                {statusMessage}
              </div>
            ) : null}
          </div>
        )}

        <main className="mt-8 grid gap-6 lg:grid-cols-5">
          <section className="space-y-6 lg:col-span-3">
            <SessionCard session={session} />
            <ConversationTimeline messages={messages} />
            <UtteranceForm
              sessionId={session?.sessionId}
              isLoading={isSending}
              onSubmit={handleUtterance}
            />
            <EmbeddedAgentPanel auth={auth} />
          </section>

          <aside className="space-y-6 lg:col-span-2">
            <AuthPanel value={auth} onChange={setAuth} />
            <SessionLauncher
              value={sessionForm}
              onChange={setSessionForm}
              onLaunch={handleStartConversation}
              isLoading={isStarting}
              hasSession={!conversationDisabled}
            />
            <SummaryPanel
              summary={summary}
              sessionId={session?.sessionId}
              isLoading={isLoadingSummary}
              onRefresh={handleRefreshSummary}
            />
            <VoiceAgentPanel
              disabled={conversationDisabled}
              isLoading={isSpeaking}
              onSpeak={handleSpeakWithVoiceAgent}
            />
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
