import { sessionStore } from '../stores/sessionStore.js';

export const sessionService = {
  startSession: ({
    userId,
    deviceId,
    locale,
    capabilities,
    context,
  }: {
    userId: string;
    deviceId: string;
    locale: string;
    capabilities: {
      audioFormat: string;
      supportsText: boolean;
      wantsProactiveGreeting: boolean;
    };
    context: {
      timezone?: string;
      entryPoint?: string;
    };
  }) => {
    const session = sessionStore.createSession({
      userId,
      deviceId,
      locale,
      capabilities,
      context,
    });

    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      websocketUrl: `wss://api.lifecompanion.app/ws/conversation?sess=${session.id}`,
      uploadUrl: 'https://api.lifecompanion.app/api/user-utterance',
      shouldAgentSpeakFirst: session.shouldAgentSpeakFirst,
      initialPromptToken: `turn_${session.id.slice(-6)}`,
      iceBreakers: [
        'How did you sleep?',
        'What would feel supportive today?',
      ],
    };
  },
};
