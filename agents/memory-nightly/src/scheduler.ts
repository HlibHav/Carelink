import cron from 'node-cron';

import { config } from './config.js';
import { runDailyDigest } from './handlers/digest.js';
import { runCompress } from './handlers/compress.js';
import { evolvePlaybook } from './handlers/evolvePlaybook.js';

/**
 * Setup scheduled nightly jobs
 * Runs at the configured cron schedule (default: 2 AM daily)
 */
export function setupScheduler(): void {
  if (!config.nightly.enabled) {
    console.log('Nightly jobs are disabled');
    return;
  }

  const cronExpression = config.nightly.scheduleCron;

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    console.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  console.log(`Setting up nightly scheduler with cron: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    console.log(`[${new Date().toISOString()}] Starting nightly jobs...`);

    try {
      // TODO: Get list of active users from the user service / Weaviate
      // For now, this is a placeholder that would need to be called per-user
      // In production, this would iterate over all active users

      console.log('Nightly jobs completed');
    } catch (error) {
      console.error('Error running nightly jobs:', error);
    }
  });

  console.log('Scheduler setup complete');
}

/**
 * Run nightly jobs for a specific user
 * Can be called manually for testing or triggered by Cloud Scheduler
 */
export async function runNightlyJobsForUser(userId: string): Promise<void> {
  console.log(`Running nightly jobs for user: ${userId}`);

  try {
    // 1. Generate daily digest
    await runDailyDigest(userId);

    // 2. Compress old memories
    await runCompress(userId, { olderThanDays: 30 });

    // 3. Evolve playbook (ACE cycle)
    await evolvePlaybook(userId);

    console.log(`Nightly jobs completed for user: ${userId}`);
  } catch (error) {
    console.error(`Error running nightly jobs for user ${userId}:`, error);
    throw error;
  }
}
