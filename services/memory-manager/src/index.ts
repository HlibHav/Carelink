import type { Timestamp } from '@google-cloud/firestore';
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import type { Playbook } from '@carelink/memory-storage';
import { getFirestore } from '@carelink/memory-storage';
import { getWeaviateClient, insertMemory, searchMemories } from '@carelink/weaviate-client';

import { config } from './config.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const db = getFirestore({
  projectId: config.firestore.projectId,
  emulatorHost: config.firestore.emulatorHost,
  keyFilename: config.firestore.keyFilename,
});

// Initialize Weaviate client for vector search
const weaviateClient = getWeaviateClient({
  host: config.weaviate.host,
  port: config.weaviate.port,
  scheme: config.weaviate.scheme,
  apiKey: config.weaviate.apiKey,
});

// ============================================================================
// DAYTIME OPERATIONS (Real-time, low-latency endpoints)
// ============================================================================
// These endpoints handle immediate requests during active conversations.
// They prioritize speed and availability over batch processing.

type MemoryCategory = 'facts' | 'goals' | 'gratitude' | 'safety' | 'routine';

const candidateSchema = z.object({
  category: z.enum(['facts', 'goals', 'gratitude', 'safety', 'routine']),
  text: z.string().min(1),
  importance: z.enum(['low', 'medium', 'high']).default('low'),
  metadata: z.record(z.unknown()).optional(),
});

const storeCandidateSchema = z.object({
  items: z.array(candidateSchema).min(1),
});

const saveTurnSchema = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1),
  emotion: z.record(z.unknown()).optional(),
  mode: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const retrieveDialogueSchema = z.object({
  query: z.string().default(''),
});

const digestSchema = z.object({
  date: z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), 'date must be YYYY-MM-DD')
    .optional(),
});

const normalizeTimestamp = (value?: Timestamp | string): string => {
  if (!value) {
    return new Date().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
};

async function ensureUserDocument(userId: string) {
  const ref = db.collection('users').doc(userId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await ref.set({
      createdAt: new Date().toISOString(),
      defaultProfile: {
        preferences: { tone: 'warm' },
        safety: {
          escalationContacts: [],
          fallRisk: 'unknown',
        },
      },
    });
  }
  return ref;
}

async function fetchProfile(userId: string) {
  const userRef = await ensureUserDocument(userId);
  const snap = await userRef.collection('profile').limit(1).get();
  if (snap.empty) {
    const userDoc = await userRef.get();
    return (userDoc.data()?.defaultProfile as Record<string, unknown>) ?? null;
  }
  return snap.docs[0]?.data() ?? null;
}

async function fetchSafetyProfile(userId: string) {
  const userRef = await ensureUserDocument(userId);
  const safetyDoc = await userRef.collection('profile').doc('safety').get();
  if (safetyDoc.exists) {
    const data = safetyDoc.data() ?? {};
    return data;
  }
  const userSnapshot = await userRef.get();
  return (
    (userSnapshot.data()?.defaultProfile as Record<string, unknown>)?.safety ?? {
      fallRisk: 'unknown',
      escalationContacts: [],
    }
  );
}

async function fetchRecentEntries(userId: string, category: MemoryCategory, limit = 50) {
  const userRef = await ensureUserDocument(userId);
  const snap = await userRef.collection(category).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      text: data.text as string,
      category,
      importance: (data.importance as 'low' | 'medium' | 'high') ?? 'low',
      metadata: data.metadata ?? null,
      createdAt: normalizeTimestamp(data.createdAt as Timestamp | string | undefined),
    };
  });
}

async function fetchLastConversationSnapshot(userId: string) {
  const userRef = await ensureUserDocument(userId);
  const snap = await userRef.collection('conversations').orderBy('startedAt', 'desc').limit(1).get();
  if (snap.empty) {
    return null;
  }
  const data = snap.docs[0]?.data() ?? {};
  return {
    lastMode: data.lastMode ?? null,
    lastEmotion: data.lastEmotion ?? null,
  };
}

/**
 * Load user's current playbook from Firestore
 * Returns null if no playbook exists (will use default behavior)
 */
async function loadPlaybook(userId: string): Promise<Playbook | null> {
  try {
    const userRef = db.collection('users').doc(userId);
    const playbookRef = userRef.collection('playbooks').doc('default');
    const playbookDoc = await playbookRef.get();

    if (!playbookDoc.exists) {
      return null;
    }

    const data = playbookDoc.data()!;
    return {
      playbookId: data.playbookId || 'default',
      userId,
      sections: {
        retrieval_strategies: data.sections?.retrieval_strategies || [],
        context_engineering_rules: data.sections?.context_engineering_rules || [],
        common_mistakes: data.sections?.common_mistakes || [],
      },
      metadata: {
        lastUpdated: data.metadata?.lastUpdated || new Date().toISOString(),
        version: data.metadata?.version || 1,
      },
    };
  } catch (error) {
    console.error(`Error loading playbook for user ${userId}:`, error);
    return null;
  }
}

/**
 * Apply retrieval strategies from playbook to filter/prioritize memories
 */
function applyRetrievalStrategies(
  memories: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>,
  playbook: Playbook | null,
  context: { emotion?: Record<string, unknown>; mode?: string },
): Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> {
  if (!playbook || playbook.sections.retrieval_strategies.length === 0) {
    return memories;
  }

  // Find applicable strategies based on context
  const applicableStrategies = playbook.sections.retrieval_strategies.filter((strategy) => {
    if (!strategy.condition) return false;
    // Simple condition matching (in production, use a proper condition evaluator)
    const emotionPrimary = context.emotion && typeof context.emotion === 'object' && 'primary' in context.emotion 
      ? String(context.emotion.primary) 
      : undefined;
    const emotionMatch = !emotionPrimary || strategy.condition.includes(`emotion=${emotionPrimary}`);
    const modeMatch = !context.mode || strategy.condition.includes(`mode=${context.mode}`);
    return emotionMatch && modeMatch;
  });

  // Apply strategies (for now, just return filtered memories)
  // In production, strategies would modify the retrieval logic more sophisticatedly
  let filtered = memories;

  for (const strategy of applicableStrategies) {
    // Example: If strategy mentions "last 7 days", filter by date
    if (strategy.strategy.includes('last 7 days')) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = filtered.filter((m) => new Date(m.createdAt) >= sevenDaysAgo);
    }

    // Example: If strategy mentions "gratitude", prioritize gratitude entries
    if (strategy.strategy.toLowerCase().includes('gratitude')) {
      filtered = [
        ...filtered.filter((m) => m.category === 'gratitude'),
        ...filtered.filter((m) => m.category !== 'gratitude'),
      ];
    }
  }

  return filtered;
}

/**
 * Apply context engineering rules from playbook
 */
function applyContextEngineeringRules(
  memories: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>,
  playbook: Playbook | null,
  query: string,
): Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> {
  if (!playbook || playbook.sections.context_engineering_rules.length === 0) {
    return memories;
  }

  // Find applicable rules based on query
  const applicableRules = playbook.sections.context_engineering_rules.filter((rule) => {
    if (!rule.condition) return false;
    // Simple condition matching (in production, use a proper condition evaluator)
    return rule.condition.split(' OR ').some((cond) => {
      const normalizedCond = cond.toLowerCase().trim();
      const normalizedQuery = query.toLowerCase();
      return normalizedQuery.includes(normalizedCond.replace(/['"]/g, ''));
    });
  });

  // Apply rules (for now, just return memories)
  // In production, rules would modify filtering/prioritization logic
  return memories;
}

// DAYTIME: Store candidate memories (facts, goals, gratitude, etc.)
// Called immediately after conversation turns to persist extracted memories
// Now stores in both Firestore (metadata) and Weaviate (vectors)
app.post('/memory/:userId/store-candidate', async (req, res) => {
  const parsed = storeCandidateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.params.userId;
  const now = new Date().toISOString();

  // Store in Firestore for metadata and Weaviate for vector search
  await Promise.all(
    parsed.data.items.map(async (item) => {
      const memoryId = randomUUID();
      
      // Store metadata in Firestore
      const userRef = await ensureUserDocument(userId);
      const colRef = userRef.collection(item.category);
      const docRef = colRef.doc(memoryId);
      await docRef.set({
        text: item.text,
        importance: item.importance,
        metadata: item.metadata ?? null,
        createdAt: now,
        weaviateId: memoryId, // Reference to Weaviate object
      });

      // Store in Weaviate for vector search
      // Extract category-specific fields from metadata
      const metadata = item.metadata ?? {};
      const weaviateMemory: Parameters<typeof insertMemory>[1] = {
        id: memoryId,
        userId,
        category: item.category,
        text: item.text,
        importance: item.importance,
        metadata,
        createdAt: now,
      };

      // Add category-specific fields if present in metadata
      if (item.category === 'facts' && typeof metadata.type === 'string') {
        weaviateMemory.factType = metadata.type as 'family' | 'hobby' | 'health' | 'routine';
      }
      if (item.category === 'goals' && typeof metadata.status === 'string') {
        weaviateMemory.goalStatus = metadata.status as 'active' | 'done';
      }

      await insertMemory(weaviateClient, weaviateMemory);
    }),
  );

  res.status(201).json({ stored: parsed.data.items.length });
});

// DAYTIME: Store conversation turns
// Called in real-time as each turn completes to maintain conversation state
app.post('/memory/:userId/turns', async (req, res) => {
  const parsed = saveTurnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userRef = await ensureUserDocument(req.params.userId);
  const conversationRef = userRef.collection('conversations').doc(parsed.data.sessionId);
  await conversationRef.set(
    {
      sessionId: parsed.data.sessionId,
      startedAt: new Date().toISOString(),
      lastMode: parsed.data.mode ?? null,
      lastEmotion: parsed.data.emotion ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await conversationRef.collection('turns').doc(parsed.data.turnId).set({
    turnId: parsed.data.turnId,
    role: parsed.data.role,
    text: parsed.data.text,
    emotion: parsed.data.emotion ?? null,
    mode: parsed.data.mode ?? null,
    metadata: parsed.data.metadata ?? null,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ stored: true });
});

// DAYTIME: Retrieve memories for dialogue orchestration
// Called during conversation flow to provide context to dialogue agents
// Now applies ACE playbook strategies and rules
app.post('/memory/:userId/retrieve-for-dialogue', async (req, res) => {
  const parsed = retrieveDialogueSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const query = parsed.data.query.trim();
  const userId = req.params.userId;

  // Use Weaviate for semantic search if query is provided
  // Otherwise fall back to Firestore for recent entries
  let facts: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> = [];
  let goals: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> = [];
  let gratitude: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> = [];

  if (query.length > 0) {
    // Semantic search using Weaviate - filter by category directly
    const [factsResults, goalsResults, gratitudeResults] = await Promise.all([
      searchMemories(weaviateClient, query, userId, { limit: 20, returnMetadata: true, category: 'facts' }),
      searchMemories(weaviateClient, query, userId, { limit: 20, returnMetadata: true, category: 'goals' }),
      searchMemories(weaviateClient, query, userId, { limit: 20, returnMetadata: true, category: 'gratitude' }),
    ]);

    // Map to expected format
    facts = factsResults.map((r) => ({
      id: r.id,
      text: r.properties.text,
      category: r.properties.category,
      importance: r.properties.importance,
      metadata: r.properties.metadata,
      createdAt: r.properties.createdAt,
    }));
    goals = goalsResults.map((r) => ({
      id: r.id,
      text: r.properties.text,
      category: r.properties.category,
      importance: r.properties.importance,
      metadata: r.properties.metadata,
      createdAt: r.properties.createdAt,
    }));
    gratitude = gratitudeResults.map((r) => ({
      id: r.id,
      text: r.properties.text,
      category: r.properties.category,
      importance: r.properties.importance,
      metadata: r.properties.metadata,
      createdAt: r.properties.createdAt,
    }));
  } else {
    // Fallback to Firestore for recent entries when no query
    [facts, goals, gratitude] = await Promise.all([
      fetchRecentEntries(userId, 'facts'),
      fetchRecentEntries(userId, 'goals'),
      fetchRecentEntries(userId, 'gratitude'),
    ]);
  }

  // Load profile, conversation, and playbook from Firestore
  const [profile, lastConversation, playbook] = await Promise.all([
    fetchProfile(userId),
    fetchLastConversationSnapshot(userId),
    loadPlaybook(userId),
  ]);

  // Apply retrieval strategies from playbook
  const context = {
    emotion: lastConversation?.lastEmotion as Record<string, unknown> | undefined,
    mode: lastConversation?.lastMode as string | undefined,
  };

  // Apply ACE retrieval strategies
  let filteredFacts = applyRetrievalStrategies(facts as Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>, playbook, context);
  let filteredGoals = applyRetrievalStrategies(goals as Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>, playbook, context);
  let filteredGratitude = applyRetrievalStrategies(gratitude as Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>, playbook, context);

  // Apply ACE context engineering rules
  filteredFacts = applyContextEngineeringRules(filteredFacts as Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>, playbook, query);
  filteredGoals = applyContextEngineeringRules(filteredGoals as Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>, playbook, query);
  filteredGratitude = applyContextEngineeringRules(filteredGratitude as Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>, playbook, query);

  // Log ACE application for debugging
  if (playbook) {
    console.log(`[ACE] Applied playbook v${playbook.metadata.version} for user ${userId}: ${filteredFacts.length} facts, ${filteredGoals.length} goals, ${filteredGratitude.length} gratitude`);
  }

  // Apply query-based filtering
  const filterByQuery = (items: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>) =>
    query.length
      ? items
          .filter((item) => item.text.toLowerCase().includes(query))
          .slice(0, 5)
      : items.slice(0, 5);

  res.json({
    userId: req.params.userId,
    profile: profile ?? undefined,
    facts: filterByQuery(filteredFacts),
    goals: filterByQuery(filteredGoals),
    gratitude: filterByQuery(filteredGratitude).slice(0, 3),
    lastMode: lastConversation?.lastMode ?? null,
    lastEmotion: lastConversation?.lastEmotion ?? null,
    playbookVersion: playbook?.metadata.version ?? null, // Include playbook version for tracking
  });
});

// DAYTIME: Retrieve memories for coach agent
// Called when coach agent needs goal and open loop context
app.get('/memory/:userId/retrieve-for-coach', async (req, res) => {
  const goals = await fetchRecentEntries(req.params.userId, 'goals', 100);
  res.json({
    userId: req.params.userId,
    goals,
    openLoops: goals.filter((goal) => goal.importance !== 'low'),
  });
});

// DAYTIME: Retrieve safety profile
// Called by safety agent to get escalation contacts and risk assessment
app.get('/memory/:userId/safety-profile', async (req, res) => {
  const profile = await fetchSafetyProfile(req.params.userId);
  res.json({
    userId: req.params.userId,
    ...profile,
  });
});

// ============================================================================
// NIGHTLY OPERATIONS (Batch processing, can be moved to memory-nightly agent)
// ============================================================================
// These endpoints handle batch operations that can tolerate higher latency.
// They will eventually be moved to the memory-nightly agent service.

// NIGHTLY: Generate daily digest (currently implemented here, will move to nightly agent)
// Called nightly to summarize the day's conversations
app.post('/memory/:userId/daily-digest', async (req, res) => {
  const parsed = digestSchema.safeParse(req.body ?? {});
  if (!parsed.success && req.body) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const dateStr = parsed.success && parsed.data.date ? parsed.data.date : new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const userRef = await ensureUserDocument(req.params.userId);
  const conversations = await userRef.collection('conversations').get();
  const highlights: Array<{ role: string; text: string; createdAt: string }> = [];

  await Promise.all(
    conversations.docs.map(async (conversation) => {
      const turns = await conversation.ref.collection('turns').orderBy('createdAt', 'desc').limit(50).get();
      for (const turn of turns.docs) {
        const data = turn.data();
        const createdAt = new Date(data.createdAt ?? new Date().toISOString());
        if (createdAt >= dayStart && createdAt < dayEnd) {
          highlights.push({
            role: data.role as string,
            text: data.text as string,
            createdAt: createdAt.toISOString(),
          });
        }
      }
    }),
  );

  highlights.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  res.json({
    userId: req.params.userId,
    date: dateStr,
    highlights: highlights.slice(-10),
  });
});

// NIGHTLY: Compress old memories (currently a stub, will be implemented in nightly agent)
// Called periodically to compress and consolidate old memories
app.post('/memory/:userId/compress', async (_req, res) => {
  res.json({ status: 'queued', jobId: `compress_${randomUUID()}` });
});

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'memory-manager', time: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`Memory Manager service listening on port ${config.port}`);
});
