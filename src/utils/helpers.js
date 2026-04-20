/** Wraps async route handlers so errors are forwarded to Express error middleware. */
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Standard success envelope */
const ok = (res, data = {}, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

/** Standard error envelope */
const fail = (res, message = 'Error', status = 400, errors = null) =>
  res.status(status).json({ success: false, message, ...(errors && { errors }) });

module.exports = {
  asyncHandler,
  ok,
  fail,
  haversineMeters: (lat1, lon1, lat2, lon2) => {
    const R = 6_371_000;
    const p1 = (lat1 * Math.PI) / 180,
      p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180,
      dl = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  /** Returns YYYY-MM-DD in India Standard Time */
  getISTDate: (date = new Date()) => {
    return new Date(date.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  },
  /** Returns YYYY-MM-DD HH:mm:ss in India Standard Time */
  formatIST: (date = new Date()) => {
    return new Date(date.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('T', ' ').split('.')[0];
  },
  /** Returns ISO string in IST (with +05:30 offset) */
  toISTString: (date = new Date()) => {
    const d = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    return d.toISOString().replace('Z', '+05:30');
  }
};
