/**
 * Centralized error handler.
 * Controllers should throw errors or pass to next(err).
 */
module.exports = (err, req, res, next) => {
  console.error("[error]", err);

  const status = err.statusCode || 500;
  const message = err.publicMessage || err.message || "Server error";

  return res.status(status).json({
    success: false,
    message,
    errors: err.errors || null,
  });
};
