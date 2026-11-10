/** An error with an HTTP status and a message that is safe to show clients. */
class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Express error middleware: AppError → its status; anything else → generic 500. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, message: err.message, ...err.extra });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request too large' });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate record, please try again' });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res.status(500).json({ success: false, message: 'Server error' });
}

module.exports = { AppError, asyncHandler, errorHandler };
