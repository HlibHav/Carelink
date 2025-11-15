interface LogOptions {
  event: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export function coachLog(options: LogOptions) {
  const payload = {
    timestamp: new Date().toISOString(),
    component: 'coach-agent',
    event: options.event,
    userId: options.userId ?? null,
    metadata: options.metadata ?? null,
  };
  console.log(JSON.stringify(payload));
}
