export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.code === 'VALIDATION_ERROR') {
    return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
  }
  if (err.code === 'UNAUTHORIZED') {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({ error: err.message, code: 'NOT_FOUND' });
  }
  if (err.code === 'CONFLICT') {
    return res.status(409).json({ error: err.message, code: 'CONFLICT' });
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message })
  });
};

export const createError = (message, code) => {
  const err = new Error(message);
  err.code = code;
  return err;
};
