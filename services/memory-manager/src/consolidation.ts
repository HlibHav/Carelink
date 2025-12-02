// Note: OpenAI client needs to be passed in or configured separately
// For now, we'll use environment variables and create the client here
import OpenAI from 'openai';
import type { WeaviateClient } from 'weaviate-ts-client';
import { insertMemory, searchMemories } from '@carelink/weaviate-client';
import { randomUUID } from 'node:crypto';

/**
 * Intelligent consolidation: Extract key facts from conversation turns
 * while discarding conversational noise.
 * 
 * This function analyzes recent conversation turns and extracts:
 * - Stable facts (family, routines, preferences)
 * - Goals and intentions
 * - Important events
 * - Discards: greetings, filler words, transient emotions
 */
export async function consolidateConversationTurns(
  client: WeaviateClient,
  userId: string,
  turns: Array<{ role: string; text: string; createdAt: string }>,
  options: { maxTurns?: number } = {}
): Promise<{ facts: number; goals: number; consolidated: number }> {
  if (!turns.length) {
    return { facts: 0, goals: 0, consolidated: 0 };
  }

  // Limit turns to analyze (most recent first)
  const recentTurns = turns
    .slice(-(options.maxTurns || 20))
    .filter((turn) => turn.role === 'user' && turn.text.trim().length > 10);

  if (!recentTurns.length) {
    return { facts: 0, goals: 0, consolidated: 0 };
  }

  // Combine recent turns into a conversation context
  const conversationText = recentTurns.map((turn) => turn.text).join('\n');

  // Initialize OpenAI client for consolidation
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Memory Consolidation] OPENAI_API_KEY not set, skipping consolidation');
    return { facts: 0, goals: 0, consolidated: 0 };
  }

  const openai = new OpenAI({ apiKey });
  const model = 'gpt-4o-mini'; // Use gpt-4o-mini for cost-effective consolidation

  // Use LLM to extract key facts and goals, discarding noise
  const consolidationPrompt = `You are analyzing a conversation to extract meaningful, stable facts and goals while discarding conversational noise.

Conversation turns:
${conversationText}

Extract:
1. **Stable Facts**: Concrete, verifiable information about:
   - Family members, friends, relationships
   - Routines, habits, preferences
   - Health conditions, medications (if mentioned)
   - Living situation, location details
   - Hobbies, interests, activities
   
2. **Goals**: Clear intentions, plans, or commitments:
   - Things the person wants to do or achieve
   - Promises made to themselves or others
   - Plans for the future

3. **Discard**:
   - Greetings ("hello", "how are you")
   - Filler words and expressions
   - Transient emotions without context
   - Questions without answers
   - Repetitive statements

Return ONLY a JSON array with this structure:
[
  {
    "type": "fact" | "goal",
    "text": "concise, factual statement",
    "importance": "low" | "medium" | "high",
    "category": "family" | "routine" | "health" | "hobby" | "preference" | "goal" | "other",
    "reasoning": "brief explanation why this is important"
  }
]

Be selective - only extract information that:
- Is stable and unlikely to change quickly
- Has concrete details (names, places, specific activities)
- Would be useful for future conversations
- Is not already obvious or generic

Return a JSON object with this structure:
{
  "extracted": [
    {
      "type": "fact" | "goal",
      "text": "concise, factual statement",
      "importance": "low" | "medium" | "high",
      "category": "family" | "routine" | "health" | "hobby" | "preference" | "goal" | "other",
      "reasoning": "brief explanation why this is important"
    }
  ]
}

Return only the JSON object, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a memory consolidation expert. Extract only meaningful, stable facts and goals from conversations. Return valid JSON only.',
        },
        { role: 'user', content: consolidationPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent extraction
      response_format: { type: 'json_object' }, // Required for structured JSON output
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { facts: 0, goals: 0, consolidated: 0 };
    }

    // Parse the response
    let extracted: Array<{
      type: 'fact' | 'goal';
      text: string;
      importance: 'low' | 'medium' | 'high';
      category: string;
      reasoning?: string;
    }> = [];

    try {
      const parsed = JSON.parse(content);
      // Extract from the expected structure
      extracted = parsed.extracted || parsed.items || (Array.isArray(parsed) ? parsed : []);
    } catch {
      // Try to extract JSON array from text if wrapped
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        // Try to find extracted array in object
        const objMatch = content.match(/\{[^}]*"extracted"\s*:\s*\[[\s\S]*\]/);
        if (objMatch) {
          const obj = JSON.parse(objMatch[0]);
          extracted = obj.extracted || [];
        }
      }
    }

    if (!Array.isArray(extracted) || !extracted.length) {
      return { facts: 0, goals: 0, consolidated: 0 };
    }

    // Check for duplicates by searching existing memories
    const factsToStore: Array<{
      id: string;
      userId: string;
      category: 'facts' | 'goals';
      text: string;
      importance: 'low' | 'medium' | 'high';
      factType?: 'family' | 'hobby' | 'health' | 'routine';
      goalStatus?: 'active' | 'done';
      metadata: Record<string, unknown>;
      createdAt: string;
    }> = [];

    let factsCount = 0;
    let goalsCount = 0;

    for (const item of extracted) {
      // Skip if text is too short or generic
      if (item.text.trim().length < 10) continue;

      // Check for similar existing memories using semantic search (global search)
      // Search across all users to avoid duplicates globally
      const existing = await searchMemories(client, item.text, null, {
        limit: 3,
        category: item.type === 'fact' ? 'facts' : 'goals',
      });

      // Skip if very similar memory already exists (distance < 0.2 means very similar)
      const isDuplicate = existing.some((mem) => {
        const distance = mem.distance ?? 1.0;
        return distance < 0.2 || mem.properties.text.toLowerCase() === item.text.toLowerCase();
      });

      if (isDuplicate) {
        continue;
      }

      const memoryId = randomUUID();
      const now = new Date().toISOString();

      if (item.type === 'fact') {
        factsCount++;
        factsToStore.push({
          id: memoryId,
          userId,
          category: 'facts',
          text: item.text,
          importance: item.importance,
          factType: mapCategoryToFactType(item.category),
          metadata: {
            consolidated: true,
            source: 'conversation_consolidation',
            reasoning: item.reasoning,
            category: item.category,
            extractedAt: now,
          },
          createdAt: now,
        });
      } else if (item.type === 'goal') {
        goalsCount++;
        factsToStore.push({
          id: memoryId,
          userId,
          category: 'goals',
          text: item.text,
          importance: item.importance,
          goalStatus: 'active',
          metadata: {
            consolidated: true,
            source: 'conversation_consolidation',
            reasoning: item.reasoning,
            extractedAt: now,
          },
          createdAt: now,
        });
      }
    }

    // Store consolidated memories
    await Promise.all(factsToStore.map((memory) => insertMemory(client, memory)));

    return {
      facts: factsCount,
      goals: goalsCount,
      consolidated: factsCount + goalsCount,
    };
  } catch (error) {
    console.error(`[Memory Consolidation] Error consolidating turns for user ${userId}:`, error);
    return { facts: 0, goals: 0, consolidated: 0 };
  }
}

function mapCategoryToFactType(category: string): 'family' | 'hobby' | 'health' | 'routine' | undefined {
  const normalized = category.toLowerCase();
  if (normalized.includes('family') || normalized.includes('friend')) return 'family';
  if (normalized.includes('hobby') || normalized.includes('interest')) return 'hobby';
  if (normalized.includes('health') || normalized.includes('medication')) return 'health';
  if (normalized.includes('routine') || normalized.includes('habit')) return 'routine';
  return undefined;
}

