import { randomUUID } from 'node:crypto';

import { config } from '../config.js';

const baseUrl = config.memoryManagerUrl;

export async function runCompress(
  userId: string,
  options?: { olderThanDays?: number; dryRun?: boolean },
): Promise<{
  status: string;
  jobId: string;
}> {
  const url = `${baseUrl}/memory/${userId}/compress`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options ?? {}),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Memory manager compress failed (${response.status}): ${details}`);
  }

  // Memory manager returns queued job info; if it changes, we still fall back to a stub
  try {
    return (await response.json()) as { status: string; jobId: string };
  } catch {
    return { status: 'queued', jobId: `compress_${randomUUID()}` };
  }
}
