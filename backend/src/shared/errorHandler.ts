import type { ErrorRequestHandler } from 'express';

import { HttpError } from './httpErrors.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        details: err.details,
      },
    });
  }

  console.error('Unhandled error', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again later.',
      retryable: false,
    },
  });
};
