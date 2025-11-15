export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor({
    status,
    code,
    message,
    retryable = false,
    details,
  }: {
    status: number;
    code: string;
    message: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export const errors = {
  invalidAuth: () =>
    new HttpError({
      status: 401,
      code: 'INVALID_AUTH',
      message: 'Authorization header is missing or invalid.',
    }),
  sessionNotFound: (sessionId: string) =>
    new HttpError({
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: `Session ${sessionId} not found.`,
    }),
  sessionConflict: (sessionId: string) =>
    new HttpError({
      status: 409,
      code: 'SESSION_ALREADY_ACTIVE',
      message: `Session ${sessionId} already active for this device.`,
    }),
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new HttpError({
      status: 400,
      code: 'BAD_REQUEST',
      message,
      details,
    }),
  serviceUnavailable: (message: string) =>
    new HttpError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message,
      retryable: true,
    }),
};
