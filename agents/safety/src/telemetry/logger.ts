interface LogPayload {
  event: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export function safetyLog(payload: LogPayload) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      component: 'safety-agent',
      event: payload.event,
      userId: payload.userId ?? null,
      metadata: payload.metadata ?? null,
    }),
  );
}
