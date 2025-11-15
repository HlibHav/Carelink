import { randomUUID } from 'crypto';

type Capability = {
  audioFormat: string;
  supportsText: boolean;
  wantsProactiveGreeting: boolean;
};

type SessionContext = {
  timezone?: string;
  entryPoint?: string;
};

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  locale: string;
  capabilities: Capability;
  context: SessionContext;
  createdAt: string;
  expiresAt: string;
  shouldAgentSpeakFirst: boolean;
  lastActiveAt: string;
}

export interface TurnRecord {
  turnId: string;
  sessionId: string;
  createdAt: string;
  transcript?: string;
  durationMs?: number;
  status: 'processing' | 'completed' | 'failed';
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  moodTrend: 'improving' | 'stable' | 'declining';
  bullets: string[];
  capturedGoals: Array<{ goalId: string; text: string; status: 'active' | 'done' }>;
  gratitudeEntries: Array<{ entryId: string; text: string }>;
}

class InMemoryStore {
  private sessions = new Map<string, Session>();
  private turns = new Map<string, TurnRecord>();
  private summaries = new Map<string, SessionSummary>();

  findActiveSession(userId: string, deviceId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (
        session.userId === userId &&
        session.deviceId === deviceId &&
        new Date(session.expiresAt).getTime() > Date.now()
      ) {
        return session;
      }
    }
    return undefined;
  }

  createSession(data: {
    userId: string;
    deviceId: string;
    locale: string;
    capabilities: Capability;
    context: SessionContext;
  }): Session {
    const id = `sess_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const session: Session = {
      id,
      userId: data.userId,
      deviceId: data.deviceId,
      locale: data.locale,
      capabilities: data.capabilities,
      context: data.context,
      createdAt,
      expiresAt,
      shouldAgentSpeakFirst: data.capabilities.wantsProactiveGreeting,
      lastActiveAt: createdAt,
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  upsertTurn(turn: TurnRecord): TurnRecord {
    this.turns.set(turn.turnId, turn);
    return turn;
  }

  getSummary(sessionId: string): SessionSummary | undefined {
    return this.summaries.get(sessionId);
  }

  upsertSummary(summary: SessionSummary): SessionSummary {
    this.summaries.set(summary.sessionId, summary);
    return summary;
  }
}

export const sessionStore = new InMemoryStore();
