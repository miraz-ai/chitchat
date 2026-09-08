/**
 * Centralized error handling middleware.
 * Catches unhandled errors or errors with custom status codes without leaking stack traces.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(err.details ? { details: err.details } : {})
  });
};

export default errorHandler;
