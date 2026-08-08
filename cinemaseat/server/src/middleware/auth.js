import jwt from 'jsonwebtoken';
import { createError } from './errorHandler.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(createError('No token provided', 'UNAUTHORIZED'));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { phone: payload.phone, session_id: payload.session_id };
    next();
  } catch {
    next(createError('Invalid or expired token', 'UNAUTHORIZED'));
  }
};
