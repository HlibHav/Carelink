/**
 * Types for ACE (Agentic Context Engineering) playbooks
 */

export interface PlaybookBullet {
  bulletId: string;
  condition?: string;
  helpful: number;
  harmful: number;
}

export interface RetrievalStrategy extends PlaybookBullet {
  strategy: string;
  condition: string; // e.g., "emotion=sadness AND mode=support"
}

export interface ContextEngineeringRule extends PlaybookBullet {
  rule: string; // e.g., "When user mentions family, include related facts even if similarity is lower"
  condition: string;
}

export interface CommonMistake {
  bulletId: string;
  mistake: string;
  correction: string;
}

export interface PlaybookSections {
  retrieval_strategies: RetrievalStrategy[];
  context_engineering_rules: ContextEngineeringRule[];
  common_mistakes: CommonMistake[];
}

export interface PlaybookMetadata {
  lastUpdated: string;
  version: number;
}

export interface Playbook {
  playbookId: string;
  userId: string;
  sections: PlaybookSections;
  metadata: PlaybookMetadata;
}

export interface PlaybookOperation {
  type: 'ADD' | 'UPDATE' | 'REMOVE';
  section: 'retrieval_strategies' | 'context_engineering_rules' | 'common_mistakes';
  bulletId?: string; // Required for UPDATE and REMOVE
  content?: string; // For ADD operations
  strategy?: string; // For retrieval_strategies ADD
  rule?: string; // For context_engineering_rules ADD
  mistake?: string; // For common_mistakes ADD
  correction?: string; // For common_mistakes ADD
  condition?: string; // For retrieval_strategies and context_engineering_rules
}

