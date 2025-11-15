#!/usr/bin/env node

/**
 * Test Firestore connection
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'path';
import { Firestore } from '@google-cloud/firestore';

const readEnvFile = () => {
  const envPath1 = resolve(process.cwd(), '.env/.env');
  const envPath2 = resolve(process.cwd(), '.env');
  const envPath = require('fs').existsSync(envPath1) ? envPath1 : envPath2;
  
  if (!require('fs').existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf8');
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return acc;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '');
    acc[key] = unquoted;
    return acc;
  }, {});
};

const env = readEnvFile();
const projectId = process.env.GOOGLE_PROJECT_ID || env.GOOGLE_PROJECT_ID;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_APPLICATION_CREDENTIALS;

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 Testing Firestore Connection');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📋 Configuration:');
console.log(`   Project ID: ${projectId || 'NOT SET'}`);
console.log(`   Credentials: ${keyFilename || 'NOT SET'}`);
console.log(`   File exists: ${keyFilename && require('fs').existsSync(keyFilename) ? '✅' : '❌'}\n`);

if (!projectId || !keyFilename) {
  console.error('❌ Missing required configuration');
  process.exit(1);
}

if (!require('fs').existsSync(keyFilename)) {
  console.error(`❌ Credentials file not found: ${keyFilename}`);
  process.exit(1);
}

try {
  console.log('🔌 Connecting to Firestore...');
  const db = new Firestore({
    projectId,
    keyFilename,
  });

  console.log('✅ Firestore client created\n');

  console.log('📖 Testing read operation...');
  const testDoc = db.collection('users').doc('test_user');
  const doc = await testDoc.get();
  
  if (doc.exists) {
    console.log('✅ Document exists:', doc.data());
  } else {
    console.log('ℹ️  Document does not exist (this is OK for a new user)');
  }

  console.log('\n✅ Firestore connection successful!');
  console.log('═══════════════════════════════════════════════════════════\n');
} catch (error) {
  console.error('\n❌ Firestore connection failed:');
  console.error(`   Error: ${error.message}`);
  if (error.stack) {
    console.error(`\nStack trace:`);
    console.error(error.stack);
  }
  process.exit(1);
}

