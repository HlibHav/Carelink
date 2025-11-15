import { sessionStore } from '../stores/sessionStore.js';

export const summaryService = {
  getSummary: (sessionId: string) => {
    const stored = sessionStore.getSummary(sessionId);
    if (stored) {
      return stored;
    }

    // For now, fabricate a placeholder summary so UI can be built.
    const mock = {
      sessionId,
      userId: 'unknown',
      startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      moodTrend: 'improving' as const,
      bullets: [
        'Felt calmer after breathing reminder.',
        'Committed to a 5-minute walk after lunch.',
      ],
      capturedGoals: [
        { goalId: 'goal_001', text: 'Walk after lunch', status: 'active' as const },
      ],
      gratitudeEntries: [
        { entryId: 'grat_001', text: 'Granddaughter called' },
      ],
    };

    sessionStore.upsertSummary(mock);
    return mock;
  },
};
