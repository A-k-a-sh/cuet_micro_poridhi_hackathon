import rateLimit from 'express-rate-limit';

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 3,                   // 3 OTP requests per minute per IP
  message: { error: 'Too many OTP requests', code: 'RATE_LIMITED' }
});

export const holdLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.HOLD_LIMIT_MAX || '1000', 10),
  message: { error: 'Too many hold requests', code: 'RATE_LIMITED' }
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded', code: 'RATE_LIMITED' }
});
