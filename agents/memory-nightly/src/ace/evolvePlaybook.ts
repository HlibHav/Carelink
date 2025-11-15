/**
 * ACE Evolve Playbook: Orchestrates Generation → Reflection → Curation cycle
 */

import type { Playbook, PlaybookOperation } from '@carelink/memory-storage';
import { getFirestore } from '@carelink/memory-storage';

import { config } from '../config.js';
import { curate } from './curator.js';
import { generate } from './generator.js';
import { reflect } from './reflector.js';

const db = getFirestore({
  projectId: config.firestore.projectId,
  emulatorHost: config.firestore.emulatorHost,
});

export interface EvolvePlaybookOptions {
  dateRange?: { start: string; end: string };
  force?: boolean;
}

export interface EvolvePlaybookResult {
  status: string;
  playbookId: string;
  operations: {
    added: number;
    updated: number;
    removed: number;
  };
  newVersion: number;
}

/**
 * Run the complete ACE cycle: Generation → Reflection → Curation
 */
export async function evolvePlaybook(
  userId: string,
  options?: EvolvePlaybookOptions,
): Promise<EvolvePlaybookResult> {
  const userRef = db.collection('users').doc(userId);

  // Load current playbook or create initial one
  const playbookRef = userRef.collection('playbooks').doc('default');
  const playbookDoc = await playbookRef.get();
  let currentPlaybook: Playbook;

  if (playbookDoc.exists) {
    const data = playbookDoc.data()!;
    currentPlaybook = {
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

    // Check if we should skip (recently updated and not forced)
    if (!options?.force) {
      const lastUpdated = new Date(currentPlaybook.metadata.lastUpdated);
      const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        return {
          status: 'skipped',
          playbookId: currentPlaybook.playbookId,
          operations: { added: 0, updated: 0, removed: 0 },
          newVersion: currentPlaybook.metadata.version,
        };
      }
    }
  } else {
    // Create initial playbook
    currentPlaybook = {
      playbookId: 'default',
      userId,
      sections: {
        retrieval_strategies: [],
        context_engineering_rules: [],
        common_mistakes: [],
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        version: 1,
      },
    };
  }

  // Determine date range for analysis
  const endDate = options?.dateRange?.end
    ? new Date(options.dateRange.end)
    : new Date();
  const startDate = options?.dateRange?.start
    ? new Date(options.dateRange.start)
    : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

  // Load conversation logs and execution traces
  const conversations = await userRef
    .collection('conversations')
    .where('startedAt', '>=', startDate.toISOString())
    .where('startedAt', '<=', endDate.toISOString())
    .get();

  const conversationLogs = await Promise.all(
    conversations.docs.map(async (doc) => {
      const turns = await doc.ref.collection('turns').orderBy('createdAt', 'asc').get();
      return {
        sessionId: doc.id,
        turns: turns.docs.map((turnDoc) => {
          const data = turnDoc.data();
          return {
            role: data.role as 'user' | 'assistant',
            text: data.text as string,
            emotion: data.emotion as Record<string, unknown> | undefined,
            mode: data.mode as string | undefined,
            createdAt: data.createdAt as string,
          };
        }),
      };
    }),
  );

  // TODO: Load retrieval logs and execution traces
  // For now, create placeholder data
  const retrievalLogs: Array<{
    turnId: string;
    retrievedMemories: Array<{
      category: string;
      memoryId: string;
      text: string;
      similarity?: number;
    }>;
    usedMemories: Array<{
      memoryId: string;
      used: boolean;
    }>;
  }> = [];

  // TODO: Load conversation outcomes and feedback
  const conversationOutcomes: Array<{
    sessionId: string;
    turnId: string;
    userEngagement: 'high' | 'medium' | 'low';
    endedAbruptly: boolean;
  }> = [];

  const retrievalEffectiveness: Array<{
    turnId: string;
    retrievedMemories: Array<{
      memoryId: string;
      category: string;
      similarity: number;
    }>;
    usedMemories: string[];
    unusedMemories: string[];
  }> = [];

  const playbookUsage: Array<{
    turnId: string;
    bulletIds: string[];
  }> = [];

  // Step 1: Generation
  const generationOutput = await generate(
    {
      conversationLogs,
      retrievalLogs,
    },
    config.openai.apiKey,
  );

  // Step 2: Reflection
  const reflectionOutput = await reflect(
    {
      conversationOutcomes,
      retrievalEffectiveness,
      currentPlaybook,
      playbookUsage,
    },
    config.openai.apiKey,
  );

  // Step 3: Curation
  const curationOutput = curate({
    currentPlaybook,
    reflectionOutput,
    generationOutput,
  });

  // Apply operations to playbook
  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const operation of curationOutput.operations) {
    if (operation.type === 'ADD') {
      added++;
      await applyAddOperation(currentPlaybook, operation);
    } else if (operation.type === 'UPDATE') {
      updated++;
      await applyUpdateOperation(currentPlaybook, operation);
    } else if (operation.type === 'REMOVE') {
      removed++;
      await applyRemoveOperation(currentPlaybook, operation);
    }
  }

  // Update metadata
  currentPlaybook.metadata.lastUpdated = new Date().toISOString();
  currentPlaybook.metadata.version += 1;

  // Persist updated playbook
  await playbookRef.set(currentPlaybook);

  return {
    status: 'completed',
    playbookId: currentPlaybook.playbookId,
    operations: { added, updated, removed },
    newVersion: currentPlaybook.metadata.version,
  };
}

async function applyAddOperation(playbook: Playbook, operation: PlaybookOperation): Promise<void> {
  const bulletId = generateBulletId(operation.section, playbook.sections[operation.section].length);

  if (operation.section === 'retrieval_strategies' && operation.strategy && operation.condition) {
    playbook.sections.retrieval_strategies.push({
      bulletId,
      condition: operation.condition,
      strategy: operation.strategy,
      helpful: 0,
      harmful: 0,
    });
  } else if (operation.section === 'context_engineering_rules' && operation.rule && operation.condition) {
    playbook.sections.context_engineering_rules.push({
      bulletId,
      condition: operation.condition,
      rule: operation.rule,
      helpful: 0,
      harmful: 0,
    });
  } else if (operation.section === 'common_mistakes' && operation.mistake && operation.correction) {
    playbook.sections.common_mistakes.push({
      bulletId,
      mistake: operation.mistake,
      correction: operation.correction,
    });
  }
}

async function applyUpdateOperation(playbook: Playbook, operation: PlaybookOperation): Promise<void> {
  // Updates are handled by the reflection step (updating helpful/harmful scores)
  // This is a placeholder for future update operations
}

async function applyRemoveOperation(playbook: Playbook, operation: PlaybookOperation): Promise<void> {
  if (!operation.bulletId) return;

  if (operation.section === 'retrieval_strategies') {
    playbook.sections.retrieval_strategies = playbook.sections.retrieval_strategies.filter(
      (s) => s.bulletId !== operation.bulletId,
    );
  } else if (operation.section === 'context_engineering_rules') {
    playbook.sections.context_engineering_rules = playbook.sections.context_engineering_rules.filter(
      (r) => r.bulletId !== operation.bulletId,
    );
  } else if (operation.section === 'common_mistakes') {
    playbook.sections.common_mistakes = playbook.sections.common_mistakes.filter(
      (m) => m.bulletId !== operation.bulletId,
    );
  }
}

function generateBulletId(
  section: 'retrieval_strategies' | 'context_engineering_rules' | 'common_mistakes',
  index: number,
): string {
  const prefix = section === 'retrieval_strategies' ? 'ret' : section === 'context_engineering_rules' ? 'ctx' : 'mistake';
  return `${prefix}-${String(index + 1).padStart(5, '0')}`;
}

