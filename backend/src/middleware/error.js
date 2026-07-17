// 404 handler for unknown routes.
export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found - ${req.originalUrl}`));
}

// Central error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // If headers are already sent, delegate to Express's default error handler.
  if (res.headersSent) return next(err);

  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  // Log server errors for debugging (never log expected 4xx client errors).
  if (status >= 500) {
    console.error(`[ERROR ${status}] ${req.method} ${req.originalUrl}:`, err.message);
    if (process.env.NODE_ENV !== "production") console.error(err.stack);
  }

  res.status(status).json({
    message: status >= 500 && process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : (err.message || "Server error"),
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}
