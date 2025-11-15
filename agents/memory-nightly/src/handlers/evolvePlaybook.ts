import { evolvePlaybook as runACE } from '../ace/evolvePlaybook.js';

export async function evolvePlaybook(
  userId: string,
  options?: { dateRange?: { start: string; end: string }; force?: boolean },
): Promise<{
  status: string;
  playbookId: string;
  operations: {
    added: number;
    updated: number;
    removed: number;
  };
  newVersion: number;
}> {
  const result = await runACE(userId, options);
  return result;
}

