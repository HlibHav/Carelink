export interface EvolvePlaybookOptions {
  dateRange?: { start: string; end: string };
  force?: boolean;
}

export interface EvolvePlaybookResult {
  status: 'skipped' | 'queued';
  playbookId: string;
  operations: {
    added: number;
    updated: number;
    removed: number;
  };
  newVersion: number;
  reason?: string;
}

export async function evolvePlaybook(
  userId: string,
  _options?: EvolvePlaybookOptions,
): Promise<EvolvePlaybookResult> {
  console.warn(
    `[ACE] evolvePlaybook skipped for ${userId}: Weaviate-only pipeline not implemented yet.`,
  );

  return {
    status: 'skipped',
    playbookId: 'default',
    operations: { added: 0, updated: 0, removed: 0 },
    newVersion: 1,
    reason: 'Playbook evolution pending migration to Weaviate',
  };
}
