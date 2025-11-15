import { Conversation } from '@elevenlabs/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getElevenLabsAgentConfig } from '../lib/api.js';
import { createDialogueClientTools } from '../lib/elevenLabsTools.js';
import type { AuthConfig } from '../lib/types.js';

type ConversationInstance = Awaited<ReturnType<typeof Conversation.startSession>>;

type ConversationRole = 'user' | 'agent' | 'system';

interface AgentMessage {
  id: string;
  role: ConversationRole;
  text: string;
  meta?: string;
}

const connectionChoices = [
  { label: 'WebRTC (low latency)', value: 'webrtc' as const },
  { label: 'WebSocket', value: 'websocket' as const },
] as const;

const locationChoices = [
  { label: 'United States', value: 'us' },
  { label: 'Global (US)', value: 'global' },
  { label: 'EU Residency', value: 'eu-residency' },
  { label: 'India Residency', value: 'in-residency' },
] as const;

const locationOrigins: Record<string, string | undefined> = {
  us: 'https://api.elevenlabs.io',
  global: 'https://api.elevenlabs.io',
  'eu-residency': 'https://eu.api.elevenlabs.io',
  'in-residency': 'https://in.api.elevenlabs.io',
};

const statusStyles: Record<string, string> = {
  connected: 'bg-forest/10 text-forest',
  connecting: 'bg-midnight-100 text-midnight-700',
  disconnected: 'bg-midnight-100 text-midnight-500',
};

const env = import.meta.env;
const envAgentId = (env.VITE_ELEVENLABS_AGENT_ID ?? '').trim();
const envSignedUrl = (env.VITE_ELEVENLABS_SIGNED_URL ?? '').trim();
const envConversationToken = (env.VITE_ELEVENLABS_CONVERSATION_TOKEN ?? '').trim();
const envUserId = (env.VITE_ELEVENLABS_USER_ID ?? 'demo-user').trim();
const envConnectionType = (env.VITE_ELEVENLABS_CONNECTION_TYPE ?? '').trim();
const envServerLocation = (env.VITE_ELEVENLABS_SERVER_LOCATION ?? '').trim();
const envAutoConnectPreference = (env.VITE_ELEVENLABS_AUTO_CONNECT ?? '').trim().toLowerCase();
const envAutoConnect = envAutoConnectPreference === 'true';
const envAutoConnectDisabled = envAutoConnectPreference === 'false';
const envTextOnly = (env.VITE_ELEVENLABS_TEXT_ONLY ?? '').toLowerCase() === 'true';
const envVolume = Number(env.VITE_ELEVENLABS_VOLUME ?? '0.85');
const envDebugLogging = (env.VITE_ELEVENLABS_DEBUG ?? '').trim().toLowerCase() === 'true';
const shouldDebugLogs = envDebugLogging || Boolean(import.meta.env.DEV);
const debugLog = (...args: unknown[]) => {
  if (!shouldDebugLogs) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug('[EmbeddedAgentPanel]', ...args);
};

const uuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface EmbeddedAgentPanelProps {
  auth?: AuthConfig;
}

export function EmbeddedAgentPanel({ auth }: EmbeddedAgentPanelProps) {
  const [agentId, setAgentId] = useState(envAgentId);
  const [userId, setUserId] = useState(envUserId);
  const [connectionType, setConnectionType] = useState<(typeof connectionChoices)[number]['value']>(
    connectionChoices.some((choice) => choice.value === envConnectionType)
      ? (envConnectionType as (typeof connectionChoices)[number]['value'])
      : 'webrtc',
  );
  const [serverLocation, setServerLocation] = useState<(typeof locationChoices)[number]['value']>(
    locationChoices.some((choice) => choice.value === envServerLocation)
      ? (envServerLocation as (typeof locationChoices)[number]['value'])
      : 'us',
  );
  const [signedUrl, setSignedUrl] = useState(envSignedUrl);
  const [conversationToken, setConversationToken] = useState(envConversationToken);
  const [textOnly, setTextOnly] = useState(envTextOnly);
  const [micMuted, setMicMuted] = useState(false);
  const [volume, setVolume] = useState(Number.isFinite(envVolume) ? envVolume : 0.85);
  const [micReady, setMicReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [shouldAutoConnect, setShouldAutoConnect] = useState(envAutoConnect);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [canSendFeedback, setCanSendFeedback] = useState(false);

  const conversationRef = useRef<ConversationInstance | null>(null);
  const dialogueClientTools = useMemo(
    () =>
      createDialogueClientTools({
        auth,
        defaultUserId: userId,
        onResult: (result) => {
          appendMessage({
            role: 'system',
            text: `Dialogue orchestrator: ${result.text}`,
            meta: `tone ${result.tone}`,
          });
        },
        onError: (message, error, parameters) => {
          debugLog('Dialogue orchestrator tool error', { message, parameters, error });
          setWidgetError(message);
        },
      }),
    [appendMessage, auth, setWidgetError, userId],
  );

  // Auto-load agent configuration from backend
  useEffect(() => {
    if (!auth || envAgentId || envConversationToken) {
      debugLog('Skipping backend config fetch', {
        hasAuth: Boolean(auth),
        hasEnvAgentId: Boolean(envAgentId),
        hasEnvToken: Boolean(envConversationToken),
      });
      return;
    }

    let cancelled = false;
    debugLog('Requesting agent config from backend');
    getElevenLabsAgentConfig(auth)
      .then((config) => {
        if (cancelled) return;
        if (config.agentId) {
          setAgentId(config.agentId);
        }
        if (config.conversationToken) {
          setConversationToken(config.conversationToken);
        }
        if (
          !envAutoConnectDisabled &&
          (config.agentId?.trim()?.length || config.conversationToken?.trim()?.length)
        ) {
          setShouldAutoConnect(true);
        }
        debugLog('Loaded agent config from backend', {
          hasAgentId: Boolean(config.agentId),
          hasToken: Boolean(config.conversationToken),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        debugLog('Failed to load agent config', error);
        console.warn('Failed to load agent configuration:', error);
        // Don't show error to user, just fall back to manual input
      });

    return () => {
      cancelled = true;
    };
  }, [auth]);

  const appendMessage = useCallback((entry: Omit<AgentMessage, 'id'>) => {
    const text = entry.text?.trim();
    if (!text) {
      return;
    }
    setMessages((prev) => [...prev, { ...entry, id: uuid() }]);
  }, []);

  const handleIncomingEvent = useCallback(
    (event: any) => {
      if (!event || typeof event !== 'object') {
        return;
      }
      if (shouldDebugLogs) {
        debugLog('Incoming event', { type: event.type });
      }
      switch (event.type) {
        case 'agent_response':
          appendMessage({
            role: 'agent',
            text: event.agent_response_event?.agent_response ?? '',
          });
          break;
        case 'agent_chat_response_part':
          appendMessage({
            role: 'agent',
            text: event.text_response_part?.text ?? '',
            meta: event.text_response_part?.type === 'delta' ? 'streaming' : undefined,
          });
          break;
        case 'user_transcript':
          appendMessage({
            role: 'user',
            text: event.user_transcription_event?.user_transcript ?? '',
          });
          break;
        case 'tentative_user_transcript':
          appendMessage({
            role: 'user',
            text: event.tentative_user_transcription_event?.user_transcript ?? '',
            meta: 'tentative',
          });
          break;
        case 'client_tool_call':
          appendMessage({
            role: 'system',
            text: `Client tool requested: ${event.client_tool_call?.tool_name ?? 'unknown tool'}`,
            meta: 'tool',
          });
          break;
        case 'mcp_tool_call':
          appendMessage({
            role: 'system',
            text: `MCP tool requested: ${event.mcp_tool_call?.tool_name ?? 'unknown tool'}`,
            meta: 'tool',
          });
          break;
        case 'conversation_initiation_metadata':
          appendMessage({
            role: 'system',
            text: `Conversation ready (${event.conversation_initiation_metadata_event?.conversation_id ?? 'unknown'})`,
          });
          break;
        default:
          break;
      }
    },
    [appendMessage],
  );

  const cleanUpConversation = useCallback(async () => {
    if (conversationRef.current) {
      debugLog('Cleaning up conversation session');
      try {
        await conversationRef.current.endSession();
      } catch {
        // ignore cleanup errors
      }
      conversationRef.current = null;
    }
  }, []);

  const handleRequestMic = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicReady(true);
      setWidgetError(null);
      debugLog('Microphone ready');
    } catch {
      setWidgetError('Microphone permission denied or unavailable.');
      debugLog('Microphone permission denied');
    }
  }, []);

  const buildSessionConfig = useCallback(() => {
    const trimmedAgent = agentId.trim();
    const trimmedSignedUrl = signedUrl.trim();
    const trimmedToken = conversationToken.trim();
    const trimmedUser = userId.trim();
    const base = {
      textOnly,
      userId: trimmedUser || undefined,
      origin: locationOrigins[serverLocation],
    };

    if (trimmedSignedUrl) {
      debugLog('Building session config from signed URL');
      return {
        ...base,
        signedUrl: trimmedSignedUrl,
        connectionType: 'websocket' as const,
      };
    }

    if (trimmedToken) {
      debugLog('Building session config from conversation token', {
        tokenLength: trimmedToken.length,
      });
      return {
        ...base,
        conversationToken: trimmedToken,
        connectionType: 'webrtc' as const,
      };
    }

    if (!trimmedAgent) {
      throw new Error('Provide an Agent ID or a signed URL / conversation token.');
    }

    debugLog('Building session config from Agent ID', { connectionType });
    return {
      ...base,
      agentId: trimmedAgent,
      connectionType,
    };
  }, [agentId, conversationToken, connectionType, serverLocation, signedUrl, textOnly, userId]);

  const handleConnect = useCallback(async () => {
    if (isConnecting) return;
    debugLog('Attempting to connect agent', {
      textOnly,
      preferredConnectionType: connectionType,
      hasSignedUrl: Boolean(signedUrl.trim()),
      hasConversationToken: Boolean(conversationToken.trim()),
    });
    setIsConnecting(true);
    setWidgetError(null);
    setConnectionStatus('connecting');
    try {
      await cleanUpConversation();

      if (!textOnly && !micReady) {
        await handleRequestMic();
      }

      const sessionConfig = buildSessionConfig();
      const conversation = await Conversation.startSession({
        ...sessionConfig,
        ...(dialogueClientTools ?? {}),
        onStatusChange: (next: any) => {
          const value =
            typeof next === 'string'
              ? next
              : typeof next?.status === 'string'
                ? next.status
                : undefined;
          setConnectionStatus(
            value === 'connected'
              ? 'connected'
              : value === 'connecting'
                ? 'connecting'
                : 'disconnected',
          );
        },
        onModeChange: (mode: any) => {
          const resolved =
            typeof mode === 'string'
              ? mode
              : typeof mode?.mode === 'string'
                ? mode.mode
                : 'listening';
          setIsSpeaking(resolved === 'speaking');
        },
        onCanSendFeedbackChange: (payload: any) =>
          setCanSendFeedback(Boolean(payload?.canSendFeedback ?? payload)),
        onError: (error: unknown) =>
          setWidgetError(
            typeof error === 'string'
              ? error
              : error && typeof (error as { message?: string }).message === 'string'
                ? ((error as { message: string }).message ?? 'Agent error')
                : 'Agent error',
          ),
        onMessage: handleIncomingEvent,
      });

      conversationRef.current = conversation;
      setConnectionStatus('connected');
      setStatusMessage('Agent connected.');
      appendMessage({ role: 'system', text: 'Agent connection requested.' });
      debugLog('Agent connected');
    } catch (error) {
      setWidgetError(error instanceof Error ? error.message : 'Unable to start agent session.');
      setConnectionStatus('disconnected');
      debugLog('Agent connection failed', error);
    } finally {
      setIsConnecting(false);
      setAutoConnectAttempted(true);
    }
  }, [
    appendMessage,
    buildSessionConfig,
    cleanUpConversation,
    dialogueClientTools,
    handleIncomingEvent,
    handleRequestMic,
    isConnecting,
    micReady,
    textOnly,
  ]);

  const handleDisconnect = useCallback(async () => {
    await cleanUpConversation();
    setConnectionStatus('disconnected');
    setIsSpeaking(false);
    setCanSendFeedback(false);
    appendMessage({ role: 'system', text: 'Agent session closed.' });
    debugLog('Agent disconnected');
  }, [appendMessage, cleanUpConversation]);

  const handleSendText = () => {
    const trimmed = messageInput.trim();
    if (!trimmed) {
      return;
    }
    const conv = conversationRef.current;
    if (!conv) {
      setWidgetError('Connect to the agent before sending a message.');
      return;
    }
    conv.sendUserActivity();
    conv.sendUserMessage(trimmed);
    appendMessage({ role: 'user', text: trimmed });
    setMessageInput('');
  };

  useEffect(() => {
    const timer = statusMessage ? setTimeout(() => setStatusMessage(null), 4000) : undefined;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [statusMessage]);

  useEffect(() => {
    return () => {
      cleanUpConversation();
    };
  }, [cleanUpConversation]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.setMicMuted(micMuted);
    }
  }, [micMuted]);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.setVolume({ volume });
    }
  }, [volume]);

  useEffect(() => {
    if (
      !shouldAutoConnect ||
      autoConnectAttempted ||
      isConnecting ||
      connectionStatus === 'connected'
    ) {
      return;
    }

    const hasSessionConfig =
      Boolean(signedUrl.trim()) ||
      Boolean(conversationToken.trim()) ||
      Boolean(agentId.trim());

    if (!hasSessionConfig) {
      debugLog('Auto-connect waiting for config');
      return;
    }

    debugLog('Auto-connect triggering Conversation.startSession()');
    handleConnect();
  }, [
    agentId,
    autoConnectAttempted,
    connectionStatus,
    conversationToken,
    handleConnect,
    isConnecting,
    shouldAutoConnect,
    signedUrl,
  ]);

  const messageHeader = useMemo(() => {
    if (!messages.length) {
      return 'Agent activity will appear here after connection.';
    }
    return `Event feed (${messages.length})`;
  }, [messages.length]);

  return (
    <div className="rounded-[2.5rem] bg-white/95 p-6 shadow-lg ring-1 ring-midnight-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Hosted Agent</p>
          <h2 className="text-lg font-semibold text-midnight-900">ElevenLabs Agents Widget</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[connectionStatus]}`}>
          {connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'connecting'
              ? 'Connecting…'
              : 'Idle'}
        </span>
      </div>

      {(widgetError || statusMessage) && (
        <div className="mt-4 space-y-2">
          {widgetError ? (
            <p className="rounded-3xl border border-blush/40 bg-blush/10 px-3 py-2 text-sm text-blush">
              {widgetError}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="rounded-3xl border border-forest/30 bg-forest/10 px-3 py-2 text-sm text-forest">
              {statusMessage}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-midnight-700">
          Agent ID
          <input
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            placeholder="agent_123abc"
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          />
        </label>
        <label className="text-sm font-medium text-midnight-700">
          User ID (optional)
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="user_demo"
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          />
        </label>
        <label className="text-sm font-medium text-midnight-700">
          Connection Type
          <select
            value={connectionType}
            onChange={(event) =>
              setConnectionType(event.target.value as (typeof connectionChoices)[number]['value'])
            }
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          >
            {connectionChoices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-midnight-700">
          Server Location
          <select
            value={serverLocation}
            onChange={(event) =>
              setServerLocation(event.target.value as (typeof locationChoices)[number]['value'])
            }
            className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          >
            {locationChoices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <label className="text-sm font-medium text-midnight-700">
          Signed URL (private WebSocket agents)
          <input
            value={signedUrl}
            onChange={(event) => setSignedUrl(event.target.value)}
            placeholder="https://api.elevenlabs.io/v1/convai/conversation/get-signed-url..."
            className="mt-1 w-full rounded-2xl border border-dashed border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          />
        </label>
        <label className="text-sm font-medium text-midnight-700">
          Conversation Token (private WebRTC agents)
          <input
            value={conversationToken}
            onChange={(event) => setConversationToken(event.target.value)}
            placeholder="token_xxx"
            className="mt-1 w-full rounded-2xl border border-dashed border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-midnight-100 bg-midnight-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-midnight-900">Text only mode</p>
          <p className="text-xs text-midnight-500">Skips microphone capture.</p>
          <label className="mt-3 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={textOnly}
              onChange={(event) => setTextOnly(event.target.checked)}
              className="h-4 w-4 rounded border-midnight-300 text-midnight-900 focus:ring-midnight-400"
            />
            <span className="text-sm text-midnight-800">Run without audio</span>
          </label>
        </div>

        <div className="rounded-2xl border border-midnight-100 bg-midnight-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-midnight-900">Volume & Mic</p>
          <div className="mt-3 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-midnight-700">
              <input
                type="checkbox"
                checked={micMuted}
                onChange={(event) => setMicMuted(event.target.checked)}
                className="h-4 w-4 rounded border-midnight-300 text-midnight-900 focus:ring-midnight-400"
              />
              Mute mic
            </label>
            <label className="flex-1 text-sm text-midnight-700">
              Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="mt-2 h-1 w-full cursor-pointer rounded-full bg-midnight-200 accent-midnight-900"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRequestMic}
          className="rounded-2xl border border-midnight-200 px-4 py-2 text-sm font-semibold text-midnight-800 transition hover:border-midnight-400"
          disabled={textOnly}
        >
          {micReady || textOnly ? 'Microphone Ready' : 'Allow Microphone'}
        </button>
        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting || connectionStatus === 'connected'}
          className="rounded-2xl bg-midnight-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-midnight-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isConnecting ? 'Connecting…' : 'Connect'}
        </button>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={connectionStatus !== 'connected'}
          className="rounded-2xl border border-midnight-200 px-4 py-2 text-sm font-semibold text-midnight-800 transition hover:border-midnight-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Disconnect
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-midnight-100 bg-midnight-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-midnight-500">
          Manual Turn
        </p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            placeholder="Type a message to send to the agent"
            className="flex-1 rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
          />
          <button
            type="button"
            onClick={handleSendText}
            disabled={!messageInput.trim()}
            className="rounded-2xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send Text
          </button>
        </div>
        {canSendFeedback ? (
          <div className="mt-4 flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => conversationRef.current?.sendFeedback(true)}
              className="flex-1 rounded-2xl border border-forest/30 px-3 py-2 font-semibold text-forest hover:bg-forest/10"
            >
              👍 Good
            </button>
            <button
              type="button"
              onClick={() => conversationRef.current?.sendFeedback(false)}
              className="flex-1 rounded-2xl border border-blush/40 px-3 py-2 font-semibold text-blush hover:bg-blush/10"
            >
              👎 Needs work
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-3xl bg-white/90 p-4 shadow-inner ring-1 ring-midnight-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-midnight-800">{messageHeader}</h3>
          <span className="text-xs text-midnight-500">
            {isSpeaking ? 'Agent speaking' : 'Agent listening'}
          </span>
        </div>
        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-2">
          {messages.length === 0 ? (
            <p className="text-sm text-midnight-500">
              Connect to your agent to stream turns, transcripts, tool calls, and metadata.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl border px-3 py-2 text-sm shadow-sm ${
                  message.role === 'agent'
                    ? 'border-midnight-200 bg-midnight-50/70'
                    : message.role === 'user'
                      ? 'border-forest/30 bg-forest/5'
                      : 'border-midnight-100 bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-midnight-500">
                  <span>{message.role}</span>
                  {message.meta ? <span>{message.meta}</span> : null}
                </div>
                <p className="mt-1 text-midnight-900">{message.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
