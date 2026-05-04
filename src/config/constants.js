// ─────────────────────────────────────────────
//  App-wide constants
// ─────────────────────────────────────────────

module.exports = {
  PORT: process.env.PORT || 3000,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "face_attendance_super_secret_2025",
  JWT_EXPIRES_IN: "8h",

  // Face matching
  FACE_MATCH_THRESHOLD: 0.70, // cosine similarity ≥ 0.70 = match

  // Attendance
  DUPLICATE_WINDOW_SECONDS: 120, // prevent duplicate punch within 2 min
  VALID_EVENT_TYPES: ["CHECK_IN", "CHECK_OUT"],

  // Offline
  MAX_OFFLINE_HOURS: 12,

  // Upload
  UPLOAD_DIR: "uploads",
  MAX_FILE_SIZE_MB: 5,
};
