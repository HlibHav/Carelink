#!/usr/bin/env node

/**
 * Test script to verify Memory Manager integration with Weaviate and ACE playbooks
 * 
 * Usage:
 *   node scripts/test-memory-weaviate-ace.mjs [userId]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath1 = resolve(__dirname, '../.env/.env');
const envPath2 = resolve(__dirname, '../.env');
const envPath = existsSync(envPath1) ? envPath1 : envPath2;

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const userId = process.argv[2] || 'test-user-123';
const MEMORY_MANAGER_URL = process.env.MEMORY_MANAGER_URL || 'http://localhost:4103';

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 Testing Memory Manager + Weaviate + ACE Integration');
console.log('═══════════════════════════════════════════════════════════');
console.log(`User ID: ${userId}`);
console.log(`Memory Manager URL: ${MEMORY_MANAGER_URL}`);
console.log('');

// Test 1: Health check
console.log('📋 Test 1: Health Check');
try {
  const healthRes = await fetch(`${MEMORY_MANAGER_URL}/healthz`);
  if (healthRes.ok) {
    console.log('✅ Memory Manager is running');
  } else {
    console.log(`❌ Memory Manager health check failed: ${healthRes.status}`);
    process.exit(1);
  }
} catch (error) {
  console.log(`❌ Cannot connect to Memory Manager: ${error.message}`);
  console.log('   Make sure Memory Manager is running on port 4103');
  process.exit(1);
}
console.log('');

// Test 2: Store test memories
console.log('📋 Test 2: Store Test Memories in Weaviate');
const testMemories = {
  items: [
    {
      category: 'facts',
      text: 'I love reading books about history',
      importance: 'high',
      metadata: { source: 'test', factType: 'hobby' },
    },
    {
      category: 'goals',
      text: 'I want to read at least one book per month',
      importance: 'high',
      metadata: { source: 'test', goalStatus: 'active' },
    },
    {
      category: 'gratitude',
      text: 'I am grateful for my family support',
      importance: 'medium',
      metadata: { source: 'test' },
    },
  ],
};

try {
  const storeRes = await fetch(`${MEMORY_MANAGER_URL}/memory/${userId}/store-candidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testMemories),
  });

  if (storeRes.ok) {
    const result = await storeRes.json();
    console.log(`✅ Stored ${result.stored} memories`);
  } else {
    const error = await storeRes.json();
    console.log(`❌ Failed to store memories: ${JSON.stringify(error)}`);
  }
} catch (error) {
  console.log(`❌ Error storing memories: ${error.message}`);
}
console.log('');

// Test 3: Semantic search with Weaviate
console.log('📋 Test 3: Semantic Search via Weaviate');
try {
  const searchRes = await fetch(`${MEMORY_MANAGER_URL}/memory/${userId}/retrieve-for-dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'books and reading' }),
  });

  if (searchRes.ok) {
    const result = await searchRes.json();
    console.log(`✅ Retrieved ${result.facts.length} facts, ${result.goals.length} goals, ${result.gratitude.length} gratitude entries`);
    console.log(`   Playbook version: ${result.playbookVersion || 'none (using defaults)'}`);
    
    if (result.facts.length > 0) {
      console.log(`   Sample fact: "${result.facts[0].text}"`);
    }
    if (result.goals.length > 0) {
      console.log(`   Sample goal: "${result.goals[0].text}"`);
    }
  } else {
    const error = await searchRes.json();
    console.log(`❌ Failed to retrieve memories: ${JSON.stringify(error)}`);
  }
} catch (error) {
  console.log(`❌ Error retrieving memories: ${error.message}`);
}
console.log('');

// Test 4: Verify ACE playbook loading
console.log('📋 Test 4: ACE Playbook Loading');
try {
  const searchRes = await fetch(`${MEMORY_MANAGER_URL}/memory/${userId}/retrieve-for-dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test' }),
  });

  if (searchRes.ok) {
    const result = await searchRes.json();
    if (result.playbookVersion !== null && result.playbookVersion !== undefined) {
      console.log(`✅ Playbook loaded successfully (version: ${result.playbookVersion})`);
    } else {
      console.log(`⚠️  No playbook found (using default behavior)`);
      console.log(`   This is OK for new users - playbook will be created by nightly agent`);
    }
  } else {
    console.log(`❌ Failed to check playbook: ${searchRes.status}`);
  }
} catch (error) {
  console.log(`❌ Error checking playbook: ${error.message}`);
}
console.log('');

// Test 5: Test without query (should use Firestore fallback)
console.log('📋 Test 5: Fallback to Firestore (no query)');
try {
  const searchRes = await fetch(`${MEMORY_MANAGER_URL}/memory/${userId}/retrieve-for-dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '' }),
  });

  if (searchRes.ok) {
    const result = await searchRes.json();
    console.log(`✅ Fallback working: ${result.facts.length} facts, ${result.goals.length} goals`);
  } else {
    console.log(`❌ Fallback failed: ${searchRes.status}`);
  }
} catch (error) {
  console.log(`❌ Error testing fallback: ${error.message}`);
}
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ Testing complete!');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📝 Next steps:');
console.log('   1. Check Weaviate logs to verify vector search');
console.log('   2. Check Firestore to verify metadata storage');
console.log('   3. Create a playbook manually to test ACE strategies');
console.log('');

