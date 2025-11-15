export interface MemoryVector {
  id: string;
  userId: string;
  category: 'facts' | 'goals' | 'gratitude' | 'safety' | 'routine';
  text: string;
  importance: 'low' | 'medium' | 'high';
  embedding?: number[];
  
  // Category-specific fields
  factType?: 'family' | 'hobby' | 'health' | 'routine'; // For category=facts
  goalStatus?: 'active' | 'done'; // For category=goals
  
  // Metadata & timestamps
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  
  // Analytics fields (for ACE playbooks)
  retrievalCount?: number;
  lastRetrievedAt?: string;
}

export interface WeaviateConfig {
  host?: string;
  port?: number;
  scheme?: 'http' | 'https';
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface SearchOptions {
  limit?: number;
  where?: Record<string, unknown>;
  returnMetadata?: boolean;
  returnVector?: boolean;
  category?: 'facts' | 'goals' | 'gratitude' | 'safety' | 'routine';
  factType?: 'family' | 'hobby' | 'health' | 'routine';
  goalStatus?: 'active' | 'done';
  importance?: 'low' | 'medium' | 'high';
  minImportance?: 'low' | 'medium' | 'high';
}

export interface SearchResult {
  id: string;
  properties: Omit<MemoryVector, 'id' | 'embedding'>;
  distance?: number;
  score?: number;
  vector?: number[];
}

