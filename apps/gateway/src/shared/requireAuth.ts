import type { RequestHandler } from 'express';

import { errors } from './httpErrors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    deviceId?: string;
    clientVersion?: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const authHeader = req.get('authorization');
  const userId = req.get('x-user-id');
  const deviceId = req.get('x-device-id');
  const clientVersion = req.get('x-client-version');

  if (!authHeader || !userId || !deviceId) {
    return next(errors.invalidAuth());
  }

  // Actual token verification would happen here.

  req.userId = userId;
  req.deviceId = deviceId;
  req.clientVersion = clientVersion ?? 'unknown';

  next();
};
