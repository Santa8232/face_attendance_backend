/** Wraps async route handlers so errors are forwarded to Express error middleware. */
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Standard success envelope */
const ok = (res, data = {}, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

/** Standard error envelope */
const fail = (res, message = 'Error', status = 400, errors = null) =>
  res.status(status).json({ success: false, message, ...(errors && { errors }) });

module.exports = { asyncHandler, ok, fail };
