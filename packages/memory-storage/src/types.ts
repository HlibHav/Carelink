/**
 * Shared types for memory storage operations
 */

export type MemoryCategory = 'facts' | 'goals' | 'gratitude' | 'safety' | 'routine';

export interface MemoryEntry {
  id: string;
  text: string;
  category: MemoryCategory;
  importance: 'low' | 'medium' | 'high';
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ConversationSnapshot {
  lastMode: string | null;
  lastEmotion: Record<string, unknown> | null;
}

