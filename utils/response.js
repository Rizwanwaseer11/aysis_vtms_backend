/**
 * Standard API responses for long-term maintainability.
 */
function ok(res, message, data = null, meta = null, status = 200) {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(status).json(payload);
}

function fail(res, message, errors = null, status = 400) {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(status).json(payload);
}

module.exports = { ok, fail };
