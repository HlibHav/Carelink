import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

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

interface AppleHealthRecord {
  type: string;
  value?: string | number;
  unit?: string;
  startDate: string;
  endDate?: string;
}

interface ImportOptions {
  userId: string;
  filePath: string;
  days: number;
}

const MEMORY_MANAGER_URL = process.env.MEMORY_MANAGER_URL?.replace(/\/$/, '') ?? 'http://localhost:4103';
const DEFAULT_USER_ID =
  process.env.VITE_ELEVENLABS_USER_ID ??
  process.env.DIALOGUE_DEFAULT_USER_ID ??
  process.env.DEMO_USER_ID;

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const opts: Partial<ImportOptions> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--user':
      case '-u':
        opts.userId = args[i + 1];
        i += 1;
        break;
      case '--file':
      case '-f':
        opts.filePath = args[i + 1];
        i += 1;
        break;
      case '--days':
      case '-d':
        opts.days = Number(args[i + 1]);
        i += 1;
        break;
      default:
        break;
    }
  }
  const userId = opts.userId ?? DEFAULT_USER_ID;
  if (!userId) {
    throw new Error('Missing --user argument (and no default user id set)');
  }
  const filePath = opts.filePath ?? process.env.APPLE_HEALTH_EXPORT;
  if (!filePath) {
    throw new Error('Provide --file path or set APPLE_HEALTH_EXPORT');
  }
  if (!existsSync(filePath)) {
    throw new Error(`Apple Health export not found at ${filePath}`);
  }
  return {
    userId,
    filePath,
    days: opts.days ?? 7,
  };
}

function coerceRecords(data: unknown): AppleHealthRecord[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data as AppleHealthRecord[];
  }
  if (typeof data === 'object' && Array.isArray((data as any).records)) {
    return (data as any).records as AppleHealthRecord[];
  }
  return [];
}

function dateKey(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

function hoursBetween(start: string, end?: string): number {
  if (!end) return 0;
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) return 0;
  return (endDate - startDate) / (1000 * 60 * 60);
}

function formatNumber(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function importAppleHealth() {
  const { userId, filePath, days } = parseArgs();
  const raw = await readFile(filePath, 'utf8');
  const json = JSON.parse(raw);
  const records = coerceRecords(json);
  if (!records.length) {
    throw new Error('No Apple Health records found in file');
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const stepsPerDay = new Map<string, number>();
  const heartRates: number[] = [];
  const restingHeartRates: number[] = [];
  const sleepPerDay = new Map<string, number>();

  for (const record of records) {
    if (!record?.type || !record.startDate) continue;
    const startDate = new Date(record.startDate);
    if (Number.isNaN(startDate.getTime()) || startDate < cutoff) {
      continue;
    }
    const key = dateKey(record.startDate);
    const numericValue = typeof record.value === 'string' ? parseFloat(record.value) : Number(record.value ?? 0);

    switch (record.type) {
      case 'HKQuantityTypeIdentifierStepCount': {
        const prev = stepsPerDay.get(key) ?? 0;
        stepsPerDay.set(key, prev + (Number.isNaN(numericValue) ? 0 : numericValue));
        break;
      }
      case 'HKQuantityTypeIdentifierHeartRate': {
        if (!Number.isNaN(numericValue)) {
          heartRates.push(numericValue);
        }
        break;
      }
      case 'HKQuantityTypeIdentifierRestingHeartRate': {
        if (!Number.isNaN(numericValue)) {
          restingHeartRates.push(numericValue);
        }
        break;
      }
      case 'HKCategoryTypeIdentifierSleepAnalysis': {
        const hours = hoursBetween(record.startDate, record.endDate);
        if (hours > 0) {
          const prev = sleepPerDay.get(key) ?? 0;
          sleepPerDay.set(key, prev + hours);
        }
        break;
      }
      default:
        break;
    }
  }

  const facts: Array<{ text: string; importance: 'low' | 'medium' | 'high'; metadata?: Record<string, unknown> }> = [];
  const latestStepsKey = Array.from(stepsPerDay.keys()).sort().pop();
  if (latestStepsKey) {
    const steps = Math.round(stepsPerDay.get(latestStepsKey) ?? 0);
    if (steps > 0) {
      facts.push({
        text: `Apple Health: ${steps.toLocaleString('uk-UA')} кроків за ${latestStepsKey}.`,
        importance: steps < 3000 ? 'medium' : 'high',
        metadata: { source: 'apple_health', metric: 'steps', date: latestStepsKey, value: steps },
      });
    }
  }

  const heartArray = heartRates.length ? heartRates : restingHeartRates;
  if (heartArray.length) {
    const avg = formatNumber(heartArray.reduce((sum, value) => sum + value, 0) / heartArray.length, 1);
    facts.push({
      text: `Apple Health: середній пульс ${avg} уд/хв за останні ${heartArray.length} вимірювань.`,
      importance: avg > 90 ? 'medium' : 'low',
      metadata: { source: 'apple_health', metric: 'heart_rate', sampleSize: heartArray.length, value: avg },
    });
  }

  const latestSleepKey = Array.from(sleepPerDay.keys()).sort().pop();
  if (latestSleepKey) {
    const hours = formatNumber(sleepPerDay.get(latestSleepKey) ?? 0, 2);
    if (hours > 0) {
      facts.push({
        text: `Apple Health: сон тривалістю ${hours} год у ніч на ${latestSleepKey}.`,
        importance: hours < 6 ? 'medium' : 'low',
        metadata: { source: 'apple_health', metric: 'sleep', date: latestSleepKey, value: hours },
      });
    }
  }

  if (!facts.length) {
    console.warn('No Apple Health facts generated.');
    return;
  }

  const response = await fetch(`${MEMORY_MANAGER_URL}/memory/${userId}/store-candidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: facts.map((fact) => ({
        category: 'facts',
        text: fact.text,
        importance: fact.importance,
        metadata: fact.metadata,
      })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to store Apple Health facts: ${text}`);
  }

  console.log(`Stored ${facts.length} Apple Health facts for ${userId}`);
}

importAppleHealth().catch((error) => {
  console.error(error);
  process.exit(1);
});
