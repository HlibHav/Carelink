import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import dotenv from 'dotenv';

import {
  getWeaviateClient,
  ensureCollection,
  ensureUserProfileSchema,
  insertMemory,
} from '@carelink/weaviate-client';
import type { MemoryVector } from '@carelink/weaviate-client';

const envCandidates = [
  resolve(process.cwd(), '.env/.env'),
  resolve(process.cwd(), '.env'),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const DEMO_USER_ID =
  process.env.VITE_ELEVENLABS_USER_ID ??
  process.env.DIALOGUE_DEFAULT_USER_ID ??
  process.env.DEMO_USER_ID ??
  'demo-user';

const HELGA_PROFILE = {
  preferredName: 'Helga',
  name: 'Helga Schneider',
  age: 79,
  location: 'Small village near Potsdam, Brandenburg, Germany',
  livingSituation: 'Lives alone in a small single-family house',
  maritalStatus: 'Widow',
  children: [
    { name: 'Sabine', age: 54, location: 'Munich' },
    { name: 'Martin', age: 50, location: 'Hamburg' },
  ],
  grandchildren: 4,
  psychosocialBackground: {
    socialChallenges: [
      'Rural isolation with infrequent transport',
      'Children live far away',
      'Lonely on Sundays and evenings',
      'Overwhelmed by digitalization and official letters',
      'Lost close friends over past years',
    ],
    emotionalState: [
      'Moderate anxiety about health',
      'Occasional sadness',
      'Desire to remain independent',
      'Fear of becoming dependent on care facilities',
    ],
  },
  medicalHistory: {
    chronicConditions: [
      'Arthritis in both knees',
      'Hypertension',
      'Mild heart failure',
      'Chronic lower-back pain',
      'Prediabetes',
      'Mild hearing loss',
      'Gastroesophageal reflux',
    ],
    recentConcerns: [
      'Small fall last winter',
      'Increasing fatigue',
      'Fragmented sleep',
      'Occasional palpitations',
    ],
    medications: [
      'Ramipril 5 mg daily',
      'Bisoprolol 2.5 mg daily',
      'Pantoprazole 20 mg as needed',
      'Ibuprofen 400 mg occasionally',
      'Magnesium supplements',
      'Vitamin B12',
    ],
  },
  dailyRoutine: {
    morning: 'Reads local news with coffee, short walk to shop',
    afternoon: 'Waters plants, watches ARD/ZDF',
    evening: 'Tablet games, call with sister',
    sleep: 'Bedtime around 22:00',
  },
  personalityPreferences: {
    traits: ['Polite', 'Traditional', 'Warm', 'Organized'],
    likes: ['Classical music', 'Gardening', 'Baking', 'Family memories'],
    communicationStyle: 'Gentle, calm, structured',
  },
  aiCompanionNeeds: {
    emotionalSupport: true,
    healthMonitoring: [
      'Heart rate',
      'Sleep quality',
      'Activity levels',
      'Blood pressure',
      'Fall detection',
    ],
    reminders: ['Medication', 'Hydration', 'Appointments'],
    proactiveCheckins: true,
  },
  commonTopics: [
    'Fear of falling',
    'Missing her husband Klaus',
    'Concern about cost of living',
    'Difficulty with official letters',
    'Worry about knee pain',
  ],
};

const SAFETY_PROFILE = {
  escalationContacts: [],
  fallRisk: 'medium',
  notes: 'Monitor for fatigue, knee pain, and fall anxiety.',
};

/**
 * Generate a deterministic UUID v5-like ID from a string
 * Uses SHA-256 hash to create a consistent UUID format
 */
function generateDeterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const DEMO_FACTS: Array<Omit<MemoryVector, 'id'>> = [
  {
    userId: DEMO_USER_ID,
    category: 'facts',
    text: 'Мене звати Гельга Шнайдер, мені 79 років, я живу одна у маленькому будинку біля Потсдаму.',
    importance: 'high',
    factType: 'family',
    metadata: { source: 'seed-demo', derivedKey: 'profile:name' },
    createdAt: new Date().toISOString(),
  },
  {
    userId: DEMO_USER_ID,
    category: 'facts',
    text: 'Мої діти Сабіне (живе в Мюнхені) та Мартін (у Гамбурзі) рідко можуть приїхати.',
    importance: 'medium',
    factType: 'family',
    metadata: { source: 'seed-demo' },
    createdAt: new Date().toISOString(),
  },
  {
    userId: DEMO_USER_ID,
    category: 'facts',
    text: 'Страждаю на артрит колін, гіпертонію та легку серцеву недостатність, боюся падінь.',
    importance: 'high',
    factType: 'health',
    metadata: { source: 'seed-demo' },
    createdAt: new Date().toISOString(),
  },
  {
    userId: DEMO_USER_ID,
    category: 'facts',
    text: 'Найбільше люблю класичну музику, садівництво та спогади про родину.',
    importance: 'medium',
    factType: 'hobby',
    metadata: { source: 'seed-demo' },
    createdAt: new Date().toISOString(),
  },
  {
    userId: DEMO_USER_ID,
    category: 'goals',
    text: 'Хочу залишатися незалежною вдома і почуватися впевнено під час прогулянок.',
    importance: 'high',
    goalStatus: 'active',
    metadata: { source: 'seed-demo' },
    createdAt: new Date().toISOString(),
  },
  {
    userId: DEMO_USER_ID,
    category: 'gratitude',
    text: 'Я вдячна за теплі розмови з сестрою та нову традицію пити каву на балконі.',
    importance: 'medium',
    metadata: { source: 'seed-demo' },
    createdAt: new Date().toISOString(),
  },
];

async function upsertProfile(client: Awaited<ReturnType<typeof getWeaviateClient>>) {
  await ensureUserProfileSchema(client);
  const now = new Date().toISOString();
  
  // Generate deterministic UUID from userId for Weaviate ID
  const weaviateId = generateDeterministicUUID(`userprofile:${DEMO_USER_ID}`);
  
  // First, try to find existing profile by userId
  const findResult = await client.graphql
    .get()
    .withClassName('UserProfile')
    .withFields('_additional { id }')
    .withWhere({
      path: ['userId'],
      operator: 'Equal',
      valueString: DEMO_USER_ID,
    })
    .withLimit(1)
    .do();

  const existingItems = (findResult.data?.Get?.UserProfile ?? []) as Array<{ _additional?: { id?: string } }>;
  const existingId = existingItems.length > 0 && existingItems[0]._additional?.id
    ? existingItems[0]._additional.id
    : weaviateId;

  const payload = {
    userId: DEMO_USER_ID,
    profile: JSON.stringify(HELGA_PROFILE),
    safety: JSON.stringify(SAFETY_PROFILE),
    playbook: '',
    updatedAt: now,
  };

  try {
    await client.data
      .updater()
      .withClassName('UserProfile')
      .withId(existingId)
      .withProperties(payload)
      .do();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const isNotFound = message.includes('404') || message.includes('no object with id');
    if (!isNotFound) {
      throw error;
    }

    await client.data
      .creator()
      .withClassName('UserProfile')
      .withId(weaviateId)
      .withProperties({ ...payload, createdAt: now })
      .do();
  }

  console.log(`✅ Upserted profile for ${DEMO_USER_ID}`);
}

async function seed(): Promise<void> {
  const client = await getWeaviateClient();
  await ensureCollection(client);
  await upsertProfile(client);

  // Insert memories
  for (const memory of DEMO_FACTS) {
    await insertMemory(client, { ...memory, id: randomUUID() });
  }

  console.log(`Inserted ${DEMO_FACTS.length} demo memories for ${DEMO_USER_ID}`);
  console.log('Seeding complete.');
}

seed().catch((error) => {
  console.error('Failed to seed Weaviate:', error);
  process.exit(1);
});
