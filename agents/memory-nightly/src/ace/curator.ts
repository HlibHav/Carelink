/**
 * ACE Curator: Incrementally updates playbooks based on reflection output
 */

import type {
  Playbook,
  PlaybookBullet,
  PlaybookOperation,
} from '@carelink/memory-storage';

export interface CurationInput {
  currentPlaybook: Playbook;
  reflectionOutput: {
    bulletTags: Array<{
      bulletId: string;
      tag: 'helpful' | 'harmful' | 'neutral';
      reason?: string;
    }>;
    keyInsight: string;
  };
  generationOutput: {
    candidateStrategies: Array<{
      condition: string;
      strategy: string;
    }>;
    candidateRules: Array<{
      condition: string;
      rule: string;
    }>;
  };
  tokenBudget?: number;
  currentStep?: number;
  totalSteps?: number;
}

export interface CurationOutput {
  reasoning: string;
  operations: PlaybookOperation[];
}

/**
 * Curate playbook by incrementally adding/updating/removing entries
 * 
 * Follows ACE principles:
 * - Incremental updates (prevent context collapse)
 * - Preserve detailed knowledge
 * - Add new insights without removing useful ones
 */
export function curate(input: CurationInput): CurationOutput {
  const operations: PlaybookOperation[] = [];
  const reasoning: string[] = [];

  // Update helpful/harmful scores based on reflection tags
  for (const tag of input.reflectionOutput.bulletTags) {
    const bullet = findBullet(input.currentPlaybook, tag.bulletId);
    if (!bullet) continue;

    if (tag.tag === 'helpful') {
      bullet.helpful = (bullet.helpful || 0) + 1;
      reasoning.push(`Bullet ${tag.bulletId} marked as helpful: ${tag.reason}`);
    } else if (tag.tag === 'harmful') {
      bullet.harmful = (bullet.harmful || 0) + 1;
      reasoning.push(`Bullet ${tag.bulletId} marked as harmful: ${tag.reason}`);

      // If harmful score is high, consider removing
      if (bullet.harmful > bullet.helpful * 3 && bullet.harmful > 5) {
        operations.push({
          type: 'REMOVE',
          section: getSectionForBullet(input.currentPlaybook, tag.bulletId),
          bulletId: tag.bulletId,
        });
        reasoning.push(`Removing bullet ${tag.bulletId} due to high harmful score`);
      }
    }
  }

  // Add new retrieval strategies from generation
  for (const candidate of input.generationOutput.candidateStrategies) {
    // Check if similar strategy already exists
    const exists = input.currentPlaybook.sections.retrieval_strategies.some(
      (s) => s.condition === candidate.condition || s.strategy === candidate.strategy,
    );

    if (!exists) {
      const bulletId = generateBulletId('ret', input.currentPlaybook.sections.retrieval_strategies.length);
      operations.push({
        type: 'ADD',
        section: 'retrieval_strategies',
        strategy: candidate.strategy,
        condition: candidate.condition,
      });
      reasoning.push(`Adding new retrieval strategy: ${candidate.strategy}`);
    }
  }

  // Add new context engineering rules from generation
  for (const candidate of input.generationOutput.candidateRules) {
    const exists = input.currentPlaybook.sections.context_engineering_rules.some(
      (r) => r.condition === candidate.condition || r.rule === candidate.rule,
    );

    if (!exists) {
      operations.push({
        type: 'ADD',
        section: 'context_engineering_rules',
        rule: candidate.rule,
        condition: candidate.condition,
      });
      reasoning.push(`Adding new context engineering rule: ${candidate.rule}`);
    }
  }

  // Add common mistakes from reflection insights
  if (input.reflectionOutput.keyInsight.includes('error') || input.reflectionOutput.keyInsight.includes('mistake')) {
    const mistakeExists = input.currentPlaybook.sections.common_mistakes.some(
      (m) => m.mistake.includes(input.reflectionOutput.keyInsight.slice(0, 50)),
    );

    if (!mistakeExists) {
      operations.push({
        type: 'ADD',
        section: 'common_mistakes',
        mistake: `Pattern identified: ${input.reflectionOutput.keyInsight}`,
        correction: 'See reflection output for correct approach',
      });
      reasoning.push(`Adding common mistake based on reflection insight`);
    }
  }

  return {
    reasoning: reasoning.join('\n'),
    operations,
  };
}

function findBullet(playbook: Playbook, bulletId: string): PlaybookBullet | null {
  for (const section of [
    playbook.sections.retrieval_strategies,
    playbook.sections.context_engineering_rules,
  ]) {
    const bullet = section.find((b) => b.bulletId === bulletId);
    if (bullet) return bullet;
  }
  return null;
}

function getSectionForBullet(
  playbook: Playbook,
  bulletId: string,
): 'retrieval_strategies' | 'context_engineering_rules' | 'common_mistakes' {
  if (playbook.sections.retrieval_strategies.some((b) => b.bulletId === bulletId)) {
    return 'retrieval_strategies';
  }
  if (playbook.sections.context_engineering_rules.some((b) => b.bulletId === bulletId)) {
    return 'context_engineering_rules';
  }
  return 'common_mistakes';
}

function generateBulletId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(5, '0')}`;
}

