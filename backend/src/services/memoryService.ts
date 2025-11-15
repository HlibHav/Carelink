import type { Firestore } from '@google-cloud/firestore';

import { cosineSimilarity } from '../utils/cosineSimilarity.js';

import { createEmbedding } from './embeddingService.js';
import { getFirestore } from './firestoreClient.js';

type MemoryCollection = 'facts' | 'goals' | 'gratitude';

export interface MemoryEntry {
  id: string;
  text: string;
  embedding: number[];
  type?: string;
  status?: string;
  createdAt: string;
  similarity?: number;
}

export interface ConversationContext {
  profile?: Record<string, unknown>;
  facts: MemoryEntry[];
  goals: MemoryEntry[];
  gratitude: MemoryEntry[];
  lastMode?: string;
  lastEmotion?: Record<string, unknown>;
}

interface SaveTurnInput {
  userId: string;
  sessionId: string;
  turnId: string;
  role: 'user' | 'assistant';
  text: string;
  metadata?: Record<string, unknown>;
  emotion?: Record<string, unknown>;
  mode?: string;
}

class MemoryService {
  private db: Firestore;

  constructor() {
    this.db = getFirestore();
  }

  async ensureUserDocument(userId: string) {
    const ref = this.db.collection('users').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        createdAt: new Date().toISOString(),
      });
    }
    return ref;
  }

  async saveConversationTurn(input: SaveTurnInput) {
    const userRef = await this.ensureUserDocument(input.userId);
    const conversationRef = userRef.collection('conversations').doc(input.sessionId);
    const turnRef = conversationRef.collection('turns').doc(input.turnId);

    await conversationRef.set(
      {
        startedAt: new Date().toISOString(),
        lastEmotion: input.emotion,
        lastMode: input.mode,
      },
      { merge: true },
    );

    await turnRef.set({
      role: input.role,
      text: input.text,
      metadata: input.metadata ?? null,
      emotion: input.emotion ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async saveMemories(
    userId: string,
    collection: MemoryCollection,
    items: Array<{ text: string; type?: string; status?: string }>,
  ) {
    if (!items.length) {
      return;
    }

    const userRef = await this.ensureUserDocument(userId);
    const colRef = userRef.collection(collection);

    await Promise.all(
      items.map(async (item) => {
        const embedding = await createEmbedding(item.text);
        const doc = colRef.doc();
        await doc.set({
          text: item.text,
          type: item.type ?? null,
          status: item.status ?? 'active',
          embedding,
          createdAt: new Date().toISOString(),
        });
      }),
    );
  }

  private async fetchRecentEntries(
    userId: string,
    collection: MemoryCollection,
    limit = 200,
  ): Promise<MemoryEntry[]> {
    const userRef = await this.ensureUserDocument(userId);
    const snap = await userRef.collection(collection).orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<MemoryEntry, 'id'>),
    }));
  }

  private rankBySimilarity(entries: MemoryEntry[], embedding: number[], take = 5): MemoryEntry[] {
    if (!embedding.length) {
      return entries.slice(0, take);
    }

    return entries
      .map((entry) => ({
        ...entry,
        similarity: cosineSimilarity(entry.embedding ?? [], embedding),
      }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, take);
  }

  async getConversationContext(userId: string, query: string): Promise<ConversationContext> {
    const embedding = await createEmbedding(query);
    const [facts, goals, gratitude, profile, conversationSnapshot] = await Promise.all([
      this.fetchRecentEntries(userId, 'facts'),
      this.fetchRecentEntries(userId, 'goals'),
      this.fetchRecentEntries(userId, 'gratitude'),
      this.fetchFirstProfile(userId),
      this.fetchLastConversation(userId),
    ]);

    return {
      profile: profile ?? undefined,
      facts: this.rankBySimilarity(facts, embedding),
      goals: this.rankBySimilarity(goals, embedding),
      gratitude: this.rankBySimilarity(gratitude, embedding),
      lastMode: conversationSnapshot?.lastMode as string | undefined,
      lastEmotion: (conversationSnapshot?.lastEmotion as Record<string, unknown>) ?? undefined,
    };
  }

  private async fetchFirstProfile(userId: string) {
    const userRef = await this.ensureUserDocument(userId);
    const snap = await userRef.collection('profile').limit(1).get();
    return snap.docs[0]?.data() ?? null;
  }

  private async fetchLastConversation(userId: string) {
    const userRef = await this.ensureUserDocument(userId);
    const snap = await userRef.collection('conversations').orderBy('startedAt', 'desc').limit(1).get();
    return snap.docs[0]?.data() ?? null;
  }
}

export const memoryService = new MemoryService();
