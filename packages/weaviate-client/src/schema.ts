import type { WeaviateClient } from 'weaviate-ts-client';

/**
 * Weaviate collection schema for CareLink Memory storage
 * 
 * Based on architecture analysis:
 * - Facts: have additional `type` field (family, hobby, health, routine)
 * - Goals: have additional `status` field (active, done)
 * - Gratitude: simple text entries
 * - Safety: safety-related memories
 * - Routine: routine patterns
 * 
 * All memories share: userId, category, text, importance, metadata, createdAt, updatedAt
 */
export const MEMORY_COLLECTION_SCHEMA = {
  class: 'Memory',
  description: 'CareLink user memories (facts, goals, gratitude, safety, routine) with semantic search',
  
  // Vectorizer configuration
  vectorizer: 'text2vec-openai',
  
  // Properties definition
  properties: [
    // ========================================
    // Core Properties (all memory types)
    // ========================================
    {
      name: 'userId',
      dataType: ['string'],
      description: 'User ID for multi-tenancy and filtering',
      indexFilterable: true,
      indexSearchable: false,
      tokenization: 'field', // Exact match
    },
    {
      name: 'category',
      dataType: ['string'],
      description: 'Memory category: facts, goals, gratitude, safety, routine',
      indexFilterable: true,
      indexSearchable: false,
      tokenization: 'field', // Exact match
    },
    {
      name: 'text',
      dataType: ['text'],
      description: 'Memory text content - main field for semantic and keyword search',
      indexFilterable: false,
      indexSearchable: true, // Used for keyword search
      tokenization: 'word', // Word-level tokenization for better search
    },
    {
      name: 'importance',
      dataType: ['string'],
      description: 'Importance level: low, medium, high',
      indexFilterable: true,
      indexSearchable: false,
      tokenization: 'field', // Exact match
    },
    
    // ========================================
    // Category-Specific Properties
    // ========================================
    
    // For Facts: type field (family, hobby, health, routine)
    {
      name: 'factType',
      dataType: ['string'],
      description: 'Fact type (only for category=facts): family, hobby, health, routine',
      indexFilterable: true,
      indexSearchable: false,
      tokenization: 'field', // Exact match
    },
    
    // For Goals: status field (active, done)
    {
      name: 'goalStatus',
      dataType: ['string'],
      description: 'Goal status (only for category=goals): active, done',
      indexFilterable: true,
      indexSearchable: false,
      tokenization: 'field', // Exact match
    },
    
    // ========================================
    // Metadata & Timestamps
    // ========================================
    {
      name: 'metadata',
      dataType: ['text'],
      description: 'Serialized metadata (JSON string) for additional key-value pairs',
      indexFilterable: false,
      indexSearchable: false,
    },
    {
      name: 'createdAt',
      dataType: ['date'],
      description: 'Creation timestamp - used for temporal filtering and sorting',
      indexFilterable: true,
      indexSearchable: false,
    },
    {
      name: 'updatedAt',
      dataType: ['date'],
      description: 'Last update timestamp',
      indexFilterable: true,
      indexSearchable: false,
    },
    
    // ========================================
    // Additional Fields for Context Engineering
    // ========================================
    
    // For tracking retrieval effectiveness (used by ACE playbooks)
    {
      name: 'retrievalCount',
      dataType: ['int'],
      description: 'Number of times this memory was retrieved (for analytics)',
      indexFilterable: true,
      indexSearchable: false,
    },
    {
      name: 'lastRetrievedAt',
      dataType: ['date'],
      description: 'Last time this memory was retrieved',
      indexFilterable: true,
      indexSearchable: false,
    },
  ],
};

function isMetadataPropertyValid(property: any | undefined): boolean {
  if (!property) return false;
  if (!Array.isArray(property.dataType)) return false;
  return property.dataType.includes('text');
}

function isMemorySchemaUpToDate(schema: any): boolean {
  if (!schema || !Array.isArray(schema?.properties)) {
    return false;
  }

  const metadataProperty = schema.properties.find((prop: any) => prop.name === 'metadata');
  return isMetadataPropertyValid(metadataProperty);
}

function isNotFoundError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes('404') || normalized.includes('not found') || normalized.includes('does not exist');
}

/**
 * Create or update the Memory collection schema in Weaviate
 */
export async function createMemorySchema(client: WeaviateClient): Promise<void> {
  try {
    const existingSchema = await client.schema.classGetter().withClassName('Memory').do();
    if (isMemorySchemaUpToDate(existingSchema)) {
      console.log('✅ Memory collection already exists');
      return;
    }

    console.warn('⚠️ Memory schema is outdated, recreating...');
    await client.schema.classDeleter().withClassName('Memory').do();
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.error('❌ Failed to inspect existing Memory schema:', error);
      throw error;
    }
  }

  try {
    await client.schema.classCreator().withClass(MEMORY_COLLECTION_SCHEMA).do();
    console.log('✅ Memory collection schema created successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('already exists')) {
      console.warn('⚠️ Memory collection already exists, continuing');
      return;
    }
    console.error('❌ Failed to create Memory collection schema:', error);
    throw error;
  }
}

/**
 * Get the current Memory collection schema
 */
export async function getMemorySchema(client: WeaviateClient): Promise<any> {
  try {
    return await client.schema.classGetter().withClassName('Memory').do();
  } catch (error) {
    console.error('❌ Failed to get Memory collection schema:', error);
    throw error;
  }
}

/**
 * Delete the Memory collection schema (use with caution!)
 * ⚠️ This will delete ALL memory data!
 */
export async function deleteMemorySchema(client: WeaviateClient): Promise<void> {
  try {
    await client.schema.classDeleter().withClassName('Memory').do();
    console.log('✅ Memory collection schema deleted');
  } catch (error) {
    console.error('❌ Failed to delete Memory collection schema:', error);
    throw error;
  }
}

/**
 * Update Memory collection schema (limited - only some properties can be updated)
 * Note: Weaviate has limited support for schema updates.
 * Most changes require deleting and recreating the collection.
 */
export async function updateMemorySchema(
  client: WeaviateClient,
  updates: Partial<typeof MEMORY_COLLECTION_SCHEMA>
): Promise<void> {
  try {
    console.warn('⚠️  Schema updates are limited in Weaviate. Consider recreating the collection.');
    console.log('Update requested:', updates);
    // Note: Actual schema updates would require Weaviate API calls
    // For now, we'll just log the attempt
  } catch (error) {
    console.error('❌ Failed to update Memory collection schema:', error);
    throw error;
  }
}

/**
 * Schema validation helper
 * Validates that a memory object matches the schema requirements
 */
export function validateMemorySchema(memory: {
  userId: string;
  category: string;
  text: string;
  importance?: string;
  factType?: string;
  goalStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!memory.userId) errors.push('userId is required');
  if (!memory.category) errors.push('category is required');
  if (!memory.text) errors.push('text is required');

  // Category validation
  const validCategories = ['facts', 'goals', 'gratitude', 'safety', 'routine'];
  if (!validCategories.includes(memory.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`);
  }

  // Category-specific field validation
  if (memory.category === 'facts' && memory.factType) {
    const validFactTypes = ['family', 'hobby', 'health', 'routine'];
    if (!validFactTypes.includes(memory.factType)) {
      errors.push(`factType must be one of: ${validFactTypes.join(', ')}`);
    }
  }

  if (memory.category === 'goals' && memory.goalStatus) {
    const validGoalStatuses = ['active', 'done'];
    if (!validGoalStatuses.includes(memory.goalStatus)) {
      errors.push(`goalStatus must be one of: ${validGoalStatuses.join(', ')}`);
    }
  }

  // Importance validation
  if (memory.importance) {
    const validImportance = ['low', 'medium', 'high'];
    if (!validImportance.includes(memory.importance)) {
      errors.push(`importance must be one of: ${validImportance.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
