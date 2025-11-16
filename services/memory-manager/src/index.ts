import cors from 'cors';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import type { Playbook } from '@carelink/memory-storage';
import {
  getWeaviateClient,
  insertMemory,
  searchMemories,
  ensureUserProfileSchema,
  ensureConversationSchema,
  ensureTurnSchema,
} from '@carelink/weaviate-client';

import { config } from './config.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const QUERY_STOPWORDS = new Set([
  'what',
  'who',
  'whom',
  'about',
  'know',
  'tell',
  'me',
  'you',
  'your',
  'my',
  'can',
  'could',
  'would',
  'should',
  'do',
  'does',
  'did',
  'say',
  'remember',
  'think',
]);

// Initialize Weaviate client for vector search
const weaviateClientPromise = getWeaviateClient({
  url: config.weaviate.url,
  host: config.weaviate.host,
  port: config.weaviate.port,
  scheme: config.weaviate.scheme,
  apiKey: config.weaviate.apiKey,
});

const DEFAULT_PROFILE = {
  preferences: { tone: 'warm' },
  safety: {
    escalationContacts: [],
    fallRisk: 'unknown',
  },
};

type ProfileRecord = {
  profile: Record<string, unknown>;
  safety: Record<string, unknown>;
  playbook: Playbook | null;
};

const parseJson = <T>(value: unknown): T | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

/**
 * Generate a deterministic UUID v5-like ID from a string
 * Uses SHA-256 hash to create a consistent UUID format
 */
function generateDeterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function loadProfileRecord(userId: string): Promise<ProfileRecord> {
  try {
    const client = await weaviateClientPromise;
    await ensureUserProfileSchema(client);

    const result = await client.graphql
      .get()
      .withClassName('UserProfile')
      .withFields('_additional { id } profile safety playbook')
      .withWhere({
        path: ['userId'],
        operator: 'Equal',
        valueString: userId,
      })
      .withLimit(1)
      .do();

    const items = (result.data?.Get?.UserProfile ?? []) as Array<Record<string, unknown>>;
    if (!items.length) {
      const now = new Date().toISOString();
      // Generate deterministic UUID from userId
      const weaviateId = generateDeterministicUUID(`userprofile:${userId}`);
      await client.data
        .creator()
        .withClassName('UserProfile')
        .withId(weaviateId)
        .withProperties({
          userId,
          profile: JSON.stringify(DEFAULT_PROFILE),
          safety: JSON.stringify(DEFAULT_PROFILE.safety),
          playbook: '',
          updatedAt: now,
        })
        .do();

      return {
        profile: DEFAULT_PROFILE,
        safety: DEFAULT_PROFILE.safety,
        playbook: null,
      };
    }

    const payload = items[0];
    return {
      profile: parseJson<Record<string, unknown>>(payload.profile) ?? DEFAULT_PROFILE,
      safety: parseJson<Record<string, unknown>>(payload.safety) ?? DEFAULT_PROFILE.safety,
      playbook: (parseJson<Playbook>(payload.playbook) as Playbook | null) ?? null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Memory Manager] Error loading profile for user ${userId}:`, errorMessage);
    // Return default profile on error instead of crashing
    return {
      profile: DEFAULT_PROFILE,
      safety: DEFAULT_PROFILE.safety,
      playbook: null,
    };
  }
}

async function upsertConversationMeta(
  userId: string,
  sessionId: string,
  updates: { mode?: string; emotion?: Record<string, unknown> | null },
) {
  const client = await weaviateClientPromise;
  await ensureConversationSchema(client);
  const timestamp = new Date().toISOString();

  // First, try to find existing conversation by userId and sessionId
  const findResult = await client.graphql
    .get()
    .withClassName('ConversationMeta')
    .withFields('_additional { id }')
    .withWhere({
      operator: 'And',
      operands: [
        {
          path: ['userId'],
          operator: 'Equal',
          valueString: userId,
        },
        {
          path: ['sessionId'],
          operator: 'Equal',
          valueString: sessionId,
        },
      ],
    })
    .withLimit(1)
    .do();

  const existingItems = (findResult.data?.Get?.ConversationMeta ?? []) as Array<{ _additional?: { id?: string } }>;
  const weaviateId = existingItems.length > 0 && existingItems[0]._additional?.id
    ? existingItems[0]._additional.id
    : generateDeterministicUUID(`conversationmeta:${userId}:${sessionId}`);

  const properties: Record<string, unknown> = {
    userId,
    sessionId,
    updatedAt: timestamp,
    lastMode: updates.mode ?? null,
    lastEmotion: updates.emotion ? JSON.stringify(updates.emotion) : null,
  };

  try {
    await client.data
      .updater()
      .withClassName('ConversationMeta')
      .withId(weaviateId)
      .withProperties(properties)
      .do();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const isNotFound = message.includes('404') || message.includes('no object with id');
    if (!isNotFound) {
      throw error;
    }

    await client.data
      .creator()
      .withClassName('ConversationMeta')
      .withId(weaviateId)
      .withProperties({
        ...properties,
        startedAt: timestamp,
      })
      .do();
  }
}

async function createTurnRecord(
  userId: string,
  payload: {
    sessionId: string;
    turnId: string;
    role: 'user' | 'assistant';
    text: string;
    emotion?: Record<string, unknown>;
    mode?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const client = await weaviateClientPromise;
  await ensureTurnSchema(client);

  // Generate a valid UUID for Weaviate ID (it requires UUID format)
  // Store the original turnId in properties for reference
  const weaviateId = randomUUID();

  await client.data
    .creator()
    .withClassName('Turn')
    .withId(weaviateId)
    .withProperties({
      userId,
      sessionId: payload.sessionId,
      turnId: payload.turnId, // Store original turnId in properties
      role: payload.role,
      text: payload.text,
      emotion: payload.emotion ? JSON.stringify(payload.emotion) : '',
      mode: payload.mode ?? '',
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : '',
      createdAt: new Date().toISOString(),
    })
    .do();
}

async function fetchTurnsWithinRange(userId: string, start: Date, end: Date) {
  const client = await weaviateClientPromise;
  await ensureTurnSchema(client);

  const where: Record<string, unknown> = {
    operator: 'And',
    operands: [
      {
        path: ['userId'],
        operator: 'Equal',
        valueString: userId,
      },
      {
        path: ['createdAt'],
        operator: 'GreaterThanEqual',
        valueDate: start.toISOString(),
      },
      {
        path: ['createdAt'],
        operator: 'LessThan',
        valueDate: end.toISOString(),
      },
    ],
  } as const;

    const result = await client.graphql
      .get()
      .withClassName('Turn')
      .withFields('turnId role text createdAt')
      .withWhere(where)
      .withLimit(500)
      .withSort([{ path: ['createdAt'], order: 'asc' }])
      .do();

  return (result.data?.Get?.Turn ?? []) as Array<Record<string, unknown>>;
}

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

async function fetchProfile(userId: string) {
  const record = await loadProfileRecord(userId);
  return record.profile;
}

async function fetchSafetyProfile(userId: string) {
  const record = await loadProfileRecord(userId);
  return record.safety;
}

function extractPreferredName(profile?: Record<string, unknown>): string | undefined {
  if (!profile) return undefined;
  const directCandidates = [
    profile.preferredName,
    profile.preferred_name,
    profile.name,
    profile.fullName,
    profile.full_name,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  const demographics = typeof profile.demographics === 'object' ? (profile.demographics as Record<string, unknown>) : undefined;
  if (demographics) {
    const fallback = demographics.nickname ?? demographics.first_name ?? demographics.given_name;
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback.trim();
    }
  }
  return undefined;
}

async function fetchRecentEntries(userId: string, category: MemoryCategory, limit = 50) {
  try {
    const client = await weaviateClientPromise;
    const where: Record<string, unknown> = {
      operator: 'And',
      operands: [
        {
          path: ['userId'],
          operator: 'Equal',
          valueString: userId,
        },
        {
          path: ['category'],
          operator: 'Equal',
          valueString: category,
        },
      ],
    } as const;

    const result = await client.graphql
      .get()
      .withClassName('Memory')
      .withFields('_additional { id } userId category text importance metadata createdAt')
      .withWhere(where)
      .withLimit(limit)
      .withSort([{ path: ['createdAt'], order: 'desc' }])
      .do();

    type MemoryNode = {
      _additional?: { id?: string };
      text?: string;
      importance?: 'low' | 'medium' | 'high';
      metadata?: string;
      createdAt?: string;
    };
    const nodes = (result.data?.Get?.Memory ?? []) as MemoryNode[];
    return nodes.map((node) => ({
      id: String(node._additional?.id ?? randomUUID()),
      text: (node.text as string) ?? '',
      category,
      importance: (node.importance as 'low' | 'medium' | 'high') ?? 'low',
      metadata: parseJson<Record<string, unknown>>(node.metadata) ?? null,
      createdAt: typeof node.createdAt === 'string' ? node.createdAt : new Date().toISOString(),
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Memory Manager] Error fetching recent entries for user ${userId}, category ${category}:`, errorMessage);
    // Return empty array on error instead of crashing
    return [];
  }
}

async function fetchHighImportanceFacts(userId: string, limit = 20) {
  try {
    const client = await weaviateClientPromise;
    const where: Record<string, unknown> = {
      operator: 'And',
      operands: [
        {
          path: ['userId'],
          operator: 'Equal',
          valueString: userId,
        },
        {
          path: ['category'],
          operator: 'Equal',
          valueString: 'facts',
        },
        {
          operator: 'Or',
          operands: [
            { path: ['importance'], operator: 'Equal', valueString: 'high' },
            { path: ['importance'], operator: 'Equal', valueString: 'medium' },
          ],
        },
      ],
    } as const;

    const result = await client.graphql
      .get()
      .withClassName('Memory')
      .withFields('_additional { id } userId category text importance metadata createdAt')
      .withWhere(where)
      .withLimit(limit)
      .withSort([
        { path: ['importance'], order: 'desc' },
        { path: ['createdAt'], order: 'desc' },
      ])
      .do();

    type MemoryNode = {
      _additional?: { id?: string };
      text?: string;
      importance?: 'low' | 'medium' | 'high';
      metadata?: string;
      createdAt?: string;
    };
    const nodes = (result.data?.Get?.Memory ?? []) as MemoryNode[];
    return nodes.map((node) => ({
      id: String(node._additional?.id ?? randomUUID()),
      text: (node.text as string) ?? '',
      category: 'facts' as const,
      importance: (node.importance as 'low' | 'medium' | 'high') ?? 'low',
      metadata: parseJson<Record<string, unknown>>(node.metadata) ?? null,
      createdAt: typeof node.createdAt === 'string' ? node.createdAt : new Date().toISOString(),
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Memory Manager] Error fetching high-importance facts for user ${userId}:`, errorMessage);
    return [];
  }
}

async function searchFactsByNameKeywords(userId: string, keywords: string[], limit = 10) {
  try {
    const client = await weaviateClientPromise;
    // Search for facts containing name-related keywords
    const nameQueries = keywords.filter((k) => k.length >= 2);
    if (nameQueries.length === 0) {
      return [];
    }

    // Use semantic search with name-related queries
    const results = await Promise.all(
      nameQueries.map((keyword) =>
        searchMemories(client, keyword, userId, {
          limit: 5,
          category: 'facts',
          minImportance: 'medium', // Prioritize medium+ importance facts
        }),
      ),
    );

    // Flatten and deduplicate results
    const allResults = results.flat();
    const seen = new Set<string>();
    const uniqueResults: Array<{
      id: string;
      text: string;
      category: string;
      importance: string;
      metadata: unknown;
      createdAt: string;
    }> = [];

    for (const result of allResults) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        uniqueResults.push({
          id: result.id,
          text: result.properties.text,
          category: result.properties.category,
          importance: result.properties.importance,
          metadata: result.properties.metadata,
          createdAt: result.properties.createdAt,
        });
      }
    }

    return uniqueResults.slice(0, limit);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Memory Manager] Error searching facts by name keywords for user ${userId}:`, errorMessage);
    return [];
  }
}

async function fetchLastConversationSnapshot(userId: string) {
  try {
    const client = await weaviateClientPromise;
    await ensureConversationSchema(client);

    const result = await client.graphql
      .get()
      .withClassName('ConversationMeta')
      .withFields('lastMode lastEmotion')
      .withWhere({
        path: ['userId'],
        operator: 'Equal',
        valueString: userId,
      })
      .withSort([{ path: ['updatedAt'], order: 'desc' }])
      .withLimit(1)
      .do();

    const entry = (result.data?.Get?.ConversationMeta ?? [])[0] as Record<string, unknown> | undefined;
    if (!entry) {
      return null;
    }

    return {
      lastMode: (entry.lastMode as string) ?? null,
      lastEmotion: parseJson<Record<string, unknown>>(entry.lastEmotion) ?? null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Memory Manager] Error fetching last conversation snapshot for user ${userId}:`, errorMessage);
    // Return null on error instead of crashing
    return null;
  }
}

async function loadPlaybook(userId: string): Promise<Playbook | null> {
  const record = await loadProfileRecord(userId);
  return record.playbook;
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
// Stores structured metadata and vectors directly in Weaviate
app.post('/memory/:userId/store-candidate', async (req, res) => {
  try {
    const parsed = storeCandidateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const userId = req.params.userId;
    const now = new Date().toISOString();

    await Promise.all(
      parsed.data.items.map(async (item) => {
        const memoryId = randomUUID();

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

        const weaviateClient = await weaviateClientPromise;
        await insertMemory(weaviateClient, weaviateMemory);
      }),
    );

    res.status(201).json({ stored: parsed.data.items.length });
  } catch (error) {
    console.error('[Memory Manager] Error storing candidate memories:', error);
    res.status(500).json({ error: 'Failed to store memories', message: error instanceof Error ? error.message : String(error) });
  }
});

// DAYTIME: Store conversation turns
// Called in real-time as each turn completes to maintain conversation state
app.post('/memory/:userId/turns', async (req, res) => {
  try {
    const parsed = saveTurnSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    await createTurnRecord(req.params.userId, {
      sessionId: parsed.data.sessionId,
      turnId: parsed.data.turnId,
      role: parsed.data.role,
      text: parsed.data.text,
      emotion: parsed.data.emotion ?? undefined,
      mode: parsed.data.mode ?? undefined,
      metadata: parsed.data.metadata ?? undefined,
    });

    await upsertConversationMeta(req.params.userId, parsed.data.sessionId, {
      mode: parsed.data.mode ?? undefined,
      emotion: parsed.data.emotion ?? undefined,
    });

    res.status(201).json({ stored: true });
  } catch (error) {
    console.error('[Memory Manager] Error storing turn:', error);
    res.status(500).json({ error: 'Failed to store turn', message: error instanceof Error ? error.message : String(error) });
  }
});

// DAYTIME: Retrieve memories for dialogue orchestration
// Called during conversation flow to provide context to dialogue agents
// Now applies ACE playbook strategies and rules
app.post('/memory/:userId/retrieve-for-dialogue', async (req, res) => {
  try {
    const parsed = retrieveDialogueSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const query = parsed.data.query.trim();
    const userId = req.params.userId;

  // Use Weaviate for semantic search if query is provided
  // Otherwise fall back to most recent entries
  let facts: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> = [];
  let goals: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> = [];
  let gratitude: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }> = [];

  if (query.length > 0) {
    // Semantic search using Weaviate - filter by category directly
    const weaviateClient = await weaviateClientPromise;
    const [factsResults, goalsResults, gratitudeResults] = await Promise.all([
      searchMemories(weaviateClient, query, userId, { limit: 20, returnMetadata: true, category: 'facts' }),
      searchMemories(weaviateClient, query, userId, { limit: 20, returnMetadata: true, category: 'goals' }),
      searchMemories(weaviateClient, query, userId, { limit: 20, returnMetadata: true, category: 'gratitude' }),
    ]);

    // Map to expected format
    const mapResult = (result: typeof factsResults) =>
      result.map((r) => ({
        id: r.id,
        text: r.properties.text,
        category: r.properties.category,
        importance: r.properties.importance,
        metadata: r.properties.metadata,
        createdAt: r.properties.createdAt,
      }));

    facts = mapResult(factsResults);
    goals = mapResult(goalsResults);
    gratitude = mapResult(gratitudeResults);

    // Enhanced fallback: prioritize high-importance facts and name-related facts
    if (!facts.length) {
      const [highImportanceFacts, recentFacts] = await Promise.all([
        fetchHighImportanceFacts(userId, 10),
        fetchRecentEntries(userId, 'facts', 20),
      ]);
      
      // Combine and deduplicate
      const allFacts = [...highImportanceFacts, ...recentFacts];
      const seen = new Set<string>();
      facts = allFacts.filter((fact) => {
        if (seen.has(fact.id)) return false;
        seen.add(fact.id);
        return true;
      }).slice(0, 20);
    }
    
    if (!goals.length) {
      goals = await fetchRecentEntries(userId, 'goals');
    }
    if (!gratitude.length) {
      gratitude = await fetchRecentEntries(userId, 'gratitude');
    }
  } else {
    // When no query, fetch high-importance facts first, then recent ones
    const [highImportanceFacts, recentFacts, goalsResults, gratitudeResults] = await Promise.all([
      fetchHighImportanceFacts(userId, 10),
      fetchRecentEntries(userId, 'facts', 20),
      fetchRecentEntries(userId, 'goals'),
      fetchRecentEntries(userId, 'gratitude'),
    ]);
    
    // Combine high-importance and recent facts, deduplicate
    const allFacts = [...highImportanceFacts, ...recentFacts];
    const seen = new Set<string>();
    facts = allFacts.filter((fact) => {
      if (seen.has(fact.id)) return false;
      seen.add(fact.id);
      return true;
    }).slice(0, 20);
    
    goals = goalsResults;
    gratitude = gratitudeResults;
  }

  const rawFacts = [...facts];
  const rawGoals = [...goals];
  const rawGratitude = [...gratitude];

  // Load profile, conversation, and playbook from Weaviate
  const [profile, lastConversation, playbook] = await Promise.all([
    fetchProfile(userId),
    fetchLastConversationSnapshot(userId),
    loadPlaybook(userId),
  ]);

  // Additional: Try to find name-related facts from profile
  const preferredName = extractPreferredName(profile);
  if (preferredName && facts.length < 10) {
    const nameKeywords = [preferredName.toLowerCase()];
    // Also try common name variations if metadata has derivedKey
    const nameFacts = await searchFactsByNameKeywords(userId, nameKeywords, 5);
    // Merge name facts, prioritizing those not already in facts
    const existingIds = new Set(facts.map((f) => f.id));
    const newNameFacts = nameFacts.filter((f) => !existingIds.has(f.id));
    facts = [...facts, ...newNameFacts].slice(0, 20);
  }

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
  const normalizedTokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/gi, ''))
    .filter((token) => token.length >= 3);
  const tokensForFiltering = normalizedTokens.filter((token) => !QUERY_STOPWORDS.has(token));

  const filterByQuery = (
    items: Array<{ id: string; text: string; category: string; importance: string; metadata: unknown; createdAt: string }>,
    limit = 5,
  ) => {
    if (!tokensForFiltering.length) {
      return items.slice(0, limit);
    }

    const matches = items.filter((item) => {
      const text = item.text.toLowerCase();
      return tokensForFiltering.some((token) => text.includes(token));
    });

    const prioritized = matches.length > 0 ? matches : items;
    return prioritized.slice(0, limit);
  };

  res.json({
    userId: req.params.userId,
    profile: profile ?? undefined,
    facts: filterByQuery(filteredFacts),
    goals: filterByQuery(filteredGoals),
    gratitude: filterByQuery(filteredGratitude, 3),
    rawMemories: {
      facts: rawFacts,
      goals: rawGoals,
      gratitude: rawGratitude,
    },
    lastMode: lastConversation?.lastMode ?? null,
    lastEmotion: lastConversation?.lastEmotion ?? null,
    playbookVersion: playbook?.metadata.version ?? null, // Include playbook version for tracking
  });
  } catch (error) {
    console.error('[Memory Manager] Error retrieving dialogue context:', error);
    res.status(500).json({ error: 'Failed to retrieve dialogue context', message: error instanceof Error ? error.message : String(error) });
  }
});

// DAYTIME: Retrieve memories for coach agent
// Called when coach agent needs goal and open loop context
app.get('/memory/:userId/retrieve-for-coach', async (req, res) => {
  try {
    const goals = await fetchRecentEntries(req.params.userId, 'goals', 100);
    res.json({
      userId: req.params.userId,
      goals,
      openLoops: goals.filter((goal) => goal.importance !== 'low'),
    });
  } catch (error) {
    console.error('[Memory Manager] Error retrieving coach context:', error);
    res.status(500).json({ error: 'Failed to retrieve coach context', message: error instanceof Error ? error.message : String(error) });
  }
});

// DAYTIME: Retrieve safety profile
// Called by safety agent to get escalation contacts and risk assessment
app.get('/memory/:userId/safety-profile', async (req, res) => {
  try {
    const profile = await fetchSafetyProfile(req.params.userId);
    res.json({
      userId: req.params.userId,
      ...profile,
    });
  } catch (error) {
    console.error('[Memory Manager] Error retrieving safety profile:', error);
    res.status(500).json({ error: 'Failed to retrieve safety profile', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// NIGHTLY OPERATIONS (Batch processing, can be moved to memory-nightly agent)
// ============================================================================
// These endpoints handle batch operations that can tolerate higher latency.
// They will eventually be moved to the memory-nightly agent service.

// NIGHTLY: Generate daily digest (currently implemented here, will move to nightly agent)
// Called nightly to summarize the day's conversations
app.post('/memory/:userId/daily-digest', async (req, res) => {
  try {
    const parsed = digestSchema.safeParse(req.body ?? {});
    if (!parsed.success && req.body) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const dateStr = parsed.success && parsed.data.date ? parsed.data.date : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const turns = await fetchTurnsWithinRange(req.params.userId, dayStart, dayEnd);
    const highlights: Array<{ role: string; text: string; createdAt: string }> = turns.map((turn) => ({
      role: (turn.role as string) ?? 'assistant',
      text: (turn.text as string) ?? '',
      createdAt: typeof turn.createdAt === 'string' ? turn.createdAt : new Date().toISOString(),
    }));

    highlights.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    res.json({
      userId: req.params.userId,
      date: dateStr,
      highlights: highlights.slice(-10),
    });
  } catch (error) {
    console.error('[Memory Manager] Error generating daily digest:', error);
    res.status(500).json({ error: 'Failed to generate daily digest', message: error instanceof Error ? error.message : String(error) });
  }
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
