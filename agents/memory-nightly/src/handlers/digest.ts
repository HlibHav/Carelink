import { config } from '../config.js';

const baseUrl = config.memoryManagerUrl;

export async function runDailyDigest(userId: string, date?: string) {
  const url = `${baseUrl}/memory/${userId}/daily-digest`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(date ? { date } : {}),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Memory manager digest failed (${response.status}): ${details}`);
  }

  return (await response.json()) as {
    userId: string;
    date: string;
    highlights: Array<{ role: string; text: string; createdAt: string }>;
  };
}
