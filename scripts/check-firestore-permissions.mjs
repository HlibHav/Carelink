#!/usr/bin/env node

/**
 * Check Firestore permissions for service account
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'path';
import { Firestore } from '@google-cloud/firestore';

const readEnvFile = () => {
  const envPath1 = resolve(process.cwd(), '.env/.env');
  const envPath2 = resolve(process.cwd(), '.env');
  const envPath = existsSync(envPath1) ? envPath1 : envPath2;
  
  if (!existsSync(envPath)) {
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
console.log('🔍 Checking Firestore Permissions');
console.log('═══════════════════════════════════════════════════════════\n');

if (!projectId || !keyFilename) {
  console.error('❌ Missing configuration');
  console.error(`   GOOGLE_PROJECT_ID: ${projectId || 'NOT SET'}`);
  console.error(`   GOOGLE_APPLICATION_CREDENTIALS: ${keyFilename || 'NOT SET'}`);
  process.exit(1);
}

if (!existsSync(keyFilename)) {
  console.error(`❌ Credentials file not found: ${keyFilename}`);
  process.exit(1);
}

// Read credentials to get service account email
let serviceAccountEmail;
try {
  const credentials = JSON.parse(readFileSync(keyFilename, 'utf8'));
  serviceAccountEmail = credentials.client_email;
  console.log('📋 Service Account Info:');
  console.log(`   Email: ${serviceAccountEmail}`);
  console.log(`   Project ID: ${credentials.project_id}`);
  console.log(`   Project ID match: ${credentials.project_id === projectId ? '✅' : '❌'}\n`);
} catch (error) {
  console.error(`❌ Failed to read credentials: ${error.message}`);
  process.exit(1);
}

// Test Firestore operations
console.log('🔌 Testing Firestore Connection...\n');

try {
  const db = new Firestore({
    projectId,
    keyFilename,
  });

  console.log('✅ Firestore client created\n');

  // Test 1: Read operation
  console.log('📖 Test 1: Reading document...');
  const testUserRef = db.collection('users').doc('test_user');
  const doc = await testUserRef.get();
  console.log(`   ✅ Read operation successful (document exists: ${doc.exists})\n`);

  // Test 2: Write operation (create a test document)
  console.log('✍️  Test 2: Writing document...');
  const testWriteRef = db.collection('_permission_test').doc('test_' + Date.now());
  await testWriteRef.set({
    test: true,
    timestamp: new Date().toISOString(),
  });
  console.log('   ✅ Write operation successful\n');

  // Test 3: Delete test document
  console.log('🗑️  Test 3: Deleting test document...');
  await testWriteRef.delete();
  console.log('   ✅ Delete operation successful\n');

  // Test 4: List collections (requires admin permissions)
  console.log('📚 Test 4: Listing collections...');
  try {
    const collections = await db.listCollections();
    console.log(`   ✅ List collections successful (found ${collections.length} collections)\n`);
  } catch (error) {
    console.log(`   ⚠️  List collections failed (may require admin permissions): ${error.message}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ All Firestore operations successful!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📝 Summary:');
  console.log(`   Service Account: ${serviceAccountEmail}`);
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Permissions: ✅ Read, ✅ Write, ✅ Delete`);
  console.log('\n💡 If you see errors above, check IAM roles:');
  console.log('   - roles/datastore.user (basic read/write)');
  console.log('   - roles/datastore.owner (full access)');
  console.log('   - roles/datastore.viewer (read-only)');
  console.log('\n');

} catch (error) {
  console.error('\n❌ Firestore operation failed:');
  console.error(`   Error: ${error.message}`);
  
  if (error.code === 7) {
    console.error('\n💡 This looks like a permissions error.');
    console.error('   Check IAM roles for:', serviceAccountEmail);
    console.error('   Required roles: roles/datastore.user or roles/datastore.owner');
  } else if (error.code === 16) {
    console.error('\n💡 This looks like an authentication error.');
    console.error('   Verify the credentials file is valid and not expired.');
  }
  
  if (error.stack) {
    console.error(`\nStack trace:`);
    console.error(error.stack);
  }
  process.exit(1);
}

