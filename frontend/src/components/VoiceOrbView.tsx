import { Conversation } from '@elevenlabs/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getElevenLabsAgentConfig } from '../lib/api.js';
import type { AuthConfig } from '../lib/types.js';

const locationOrigins: Record<string, string | undefined> = {
  us: 'https://api.elevenlabs.io',
  global: 'https://api.elevenlabs.io',
  'eu-residency': 'https://eu.api.elevenlabs.io',
  'in-residency': 'https://in.api.elevenlabs.io',
};

const env = import.meta.env;
const envAgentId = (env.VITE_ELEVENLABS_AGENT_ID ?? '').trim();
const envSignedUrl = (env.VITE_ELEVENLABS_SIGNED_URL ?? '').trim();
const envConversationToken = (env.VITE_ELEVENLABS_CONVERSATION_TOKEN ?? '').trim();
const envConnectionType = (env.VITE_ELEVENLABS_CONNECTION_TYPE ?? 'webrtc').trim();
const envServerLocation = (env.VITE_ELEVENLABS_SERVER_LOCATION ?? 'us').trim();
const envUserId = (env.VITE_ELEVENLABS_USER_ID ?? 'demo-user').trim();
const envTextOnly = (env.VITE_ELEVENLABS_TEXT_ONLY ?? '').toLowerCase() === 'true';
const envVolume = Number(env.VITE_ELEVENLABS_VOLUME ?? '0.85');
const envAutoConnectPreference = (env.VITE_ELEVENLABS_AUTO_CONNECT ?? '').trim().toLowerCase();
const envAutoConnect = envAutoConnectPreference === 'true';
const envAutoConnectDisabled = envAutoConnectPreference === 'false';

const resolveConnectionType = () =>
  envConnectionType === 'websocket' || envConnectionType === 'webrtc'
    ? envConnectionType
    : 'webrtc';

const orbPalettes = {
  disconnected: {
    bg: 'bg-midnight-400/30',
    shadow: 'shadow-[0_0_40px_rgba(44,62,80,0.35)]',
  },
  connecting: {
    bg: 'bg-midnight-200/70',
    shadow: 'shadow-[0_0_45px_rgba(52,152,219,0.4)]',
  },
  connected: {
    bg: 'bg-gradient-to-br from-forest/80 to-blush/70',
    shadow: 'shadow-[0_0_70px_rgba(255,143,163,0.55)]',
  },
  error: {
    bg: 'bg-blush/80',
    shadow: 'shadow-[0_0_60px_rgba(239,68,68,0.55)]',
  },
};

type ConversationInstance = Awaited<ReturnType<typeof Conversation.startSession>>;

interface VoiceOrbViewProps {
  auth: AuthConfig;
}

export function VoiceOrbView({ auth }: VoiceOrbViewProps) {
  const [agentId, setAgentId] = useState(envAgentId);
  const [signedUrl] = useState(envSignedUrl);
  const [conversationToken, setConversationToken] = useState(envConversationToken);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [shouldAutoConnect, setShouldAutoConnect] = useState(envAutoConnect);

  const conversationRef = useRef<ConversationInstance | null>(null);

  useEffect(() => {
    if (!auth || envAgentId || envConversationToken || envSignedUrl) {
      return;
    }

    let cancelled = false;
    getElevenLabsAgentConfig(auth)
      .then((config) => {
        if (cancelled) return;
        const nextAgent = config.agentId?.trim();
        const nextToken = config.conversationToken?.trim();
        if (nextAgent) {
          setAgentId(nextAgent);
        }
        if (nextToken) {
          setConversationToken(nextToken);
        }
        if (!envAutoConnectDisabled && (nextAgent?.length || nextToken?.length)) {
          setShouldAutoConnect(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Unable to load ElevenLabs config for orb view', err);
        setError('Unable to load agent configuration.');
      });

    return () => {
      cancelled = true;
    };
  }, [auth]);

  const cleanUpConversation = useCallback(async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession();
      } catch {
        // ignore
      }
      conversationRef.current = null;
    }
  }, []);

  const handleRequestMic = useCallback(async () => {
    if (envTextOnly || micReady) {
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicReady(true);
    } catch {
      setError('Microphone permission denied.');
      throw new Error('Microphone permission denied.');
    }
  }, [micReady]);

  const buildSessionConfig = useCallback(() => {
    const trimmedAgent = agentId.trim();
    const trimmedSignedUrl = signedUrl.trim();
    const trimmedToken = conversationToken.trim();
    const base = {
      origin: locationOrigins[envServerLocation],
      userId: envUserId || undefined,
      textOnly: envTextOnly,
    };

    if (trimmedSignedUrl) {
      return {
        ...base,
        signedUrl: trimmedSignedUrl,
        connectionType: 'websocket' as const,
      };
    }

    if (trimmedToken) {
      return {
        ...base,
        conversationToken: trimmedToken,
        connectionType: 'webrtc' as const,
      };
    }

    if (!trimmedAgent) {
      throw new Error('Missing ElevenLabs agent configuration.');
    }

    return {
      ...base,
      agentId: trimmedAgent,
      connectionType: resolveConnectionType(),
    };
  }, [agentId, conversationToken, envServerLocation, signedUrl]);

  const handleConnect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') {
      return;
    }
    setError(null);
    setStatus('connecting');
    try {
      await cleanUpConversation();
      await handleRequestMic();
      const sessionConfig = buildSessionConfig();
      const conversation = await Conversation.startSession({
        ...sessionConfig,
        onStatusChange: (value) => {
          const resolved =
            typeof value === 'string' ? value : typeof value?.status === 'string' ? value.status : undefined;
          if (resolved === 'connected') {
            setStatus('connected');
          } else if (resolved === 'connecting') {
            setStatus('connecting');
          } else {
            setStatus('disconnected');
          }
        },
        onModeChange: (mode) => {
          const resolved =
            typeof mode === 'string' ? mode : typeof mode?.mode === 'string' ? mode.mode : 'listening';
          setIsSpeaking(resolved === 'speaking');
        },
        onError: (err) => {
          setError(
            typeof err === 'string'
              ? err
              : err && typeof (err as { message?: string }).message === 'string'
                ? (err as { message: string }).message
                : 'Agent error',
          );
          setStatus('disconnected');
        },
      });

      conversationRef.current = conversation;
      if (Number.isFinite(envVolume)) {
        conversationRef.current.setVolume({ volume: envVolume });
      }
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start agent session.');
      setStatus('disconnected');
    } finally {
      setAutoConnectAttempted(true);
    }
  }, [buildSessionConfig, cleanUpConversation, envVolume, handleRequestMic, status]);

  useEffect(() => {
    const hasConfig = Boolean(agentId.trim() || signedUrl.trim() || conversationToken.trim());
    if (!shouldAutoConnect || !hasConfig || autoConnectAttempted) {
      return;
    }
    handleConnect();
  }, [
    agentId,
    autoConnectAttempted,
    conversationToken,
    handleConnect,
    shouldAutoConnect,
    signedUrl,
  ]);

  useEffect(() => {
    return () => {
      cleanUpConversation();
    };
  }, [cleanUpConversation]);

  const orbState = useMemo(() => {
    if (error) {
      return { ...orbPalettes.error, label: 'Error', scale: 'scale-95' };
    }
    if (status === 'connecting') {
      return { ...orbPalettes.connecting, label: 'Connecting', scale: 'animate-pulse scale-95' };
    }
    if (status === 'connected') {
      return {
        ...orbPalettes.connected,
        label: isSpeaking ? 'Speaking' : 'Listening',
        scale: isSpeaking ? 'scale-110' : 'scale-100',
      };
    }
    return { ...orbPalettes.disconnected, label: 'Idle', scale: 'scale-90' };
  }, [error, isSpeaking, status]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-midnight-900 via-midnight-800 to-midnight-900 px-6 py-12 text-white">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">ElevenLabs Agent</p>
        <h1 className="mt-2 text-3xl font-semibold">LifeCompanion Orb</h1>
        <p className="mt-3 text-sm text-white/70">
          {error
            ? 'We hit a snag starting the conversation. Please check your agent credentials.'
            : 'The orb pulses when the agent speaks and glows softly while listening.'}
        </p>
        <div className="mt-10 flex items-center justify-center">
          <div
            className={`h-52 w-52 rounded-full transition-all duration-500 ${orbState.bg} ${orbState.shadow} ${orbState.scale}`}
          >
            <div className="relative h-full w-full">
              <div className="absolute inset-0 rounded-full bg-white/5" />
              <div className="absolute inset-8 rounded-full bg-white/5 blur-2xl" />
            </div>
          </div>
        </div>
        <p className="mt-6 text-base font-medium text-white/80">{orbState.label}</p>
        {error ? (
          <p className="mt-2 text-sm text-blush">{error}</p>
        ) : (
          <p className="mt-2 text-sm text-white/60">
            {status === 'connected'
              ? 'Say hello and start talking whenever you are ready.'
              : status === 'connecting'
                ? 'Setting up the voice link…'
                : 'Stand by while we prepare the agent.'}
          </p>
        )}
        {status !== 'connected' ? (
          <button
            type="button"
            onClick={handleConnect}
            className="mt-6 rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            {status === 'connecting' ? 'Connecting…' : 'Reconnect'}
          </button>
        ) : (
          <button
            type="button"
            onClick={cleanUpConversation}
            className="mt-6 rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            End Session
          </button>
        )}
      </div>
    </div>
  );
}
