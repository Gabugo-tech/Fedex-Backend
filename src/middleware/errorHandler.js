// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  console.error(`[ERROR ${status}] ${err.message}`);

  // Fix: don't leak internal error details in production for 5xx errors
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (isProduction && status >= 500)
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(status).json({ success: false, error: message });
};

module.exports = errorHandler;
