/**
 * PostgreSQL-based data store.
 * Implements the same interface as the JSON store for seamless transition.
 */

const { query } = require('./db');

const TABLES = {
  USERS:                'users',
  TEACHERS:             'teachers',
  STUDENTS:             'students',
  PRINCIPALS:           'principals',
  INSTITUTIONS:         'institutions',
  USER_ROLES:           'user_roles',
  DEPARTMENTS:          'departments',
  SUBJECTS:             'subjects',
  SHIFTS:               'shifts',
  FACE_TEMPLATES:       'face_embedding',
  ENROLLMENT_SESSIONS:  'face_enrollment',
  FACE_ENROLLMENT:      'face_enrollment',
  ENROLLMENT_SAMPLES:   'face_enrollment_images',
  ATTENDANCE_LOGS:      'teacher_attendance',
  ATTENDANCE_SUMMARY:   'attendance_daily_summary',
  GEOFENCES:            'geofences',
  ATTENDANCE_POLICIES:  'attendance_policies',
  ATTENDANCE_EXCEPTIONS:'attendance_exceptions',
  DEVICE_REGISTRY:      'user_devices',
  SYNC_QUEUE:           'sync_queue_log',
  AUDIT_LOGS:           'audit_logs',
  TEACHER_SUBJECT_MAPPING: 'teacher_subject_mapping',
  ATTENDANCE_SESSIONS:     'attendance_sessions',
  STUDENT_ATTENDANCE:      'student_attendance',
  TEACHER_ATTENDANCE:      'teacher_attendance',
  FACE_ENROLLMENT:         'face_enrollment',
  FACE_EMBEDDING:          'face_embedding',
  FACE_ENROLLMENT_IMAGES:  'face_enrollment_images',
  FACE_RECOGNITION_LOGS:   'face_recognition_logs',
  AI_SESSION_PROCESSING:   'ai_session_processing',
  LEAVE_TYPES:             'leave_types',
  LEAVE_APPLICATIONS:      'leave_applications',
  ACADEMIC_CALENDAR:       'academic_calendar',
  USER_DEVICES:            'user_devices',
  SYSTEM_SETTINGS:         'system_settings',
  NOTIFICATIONS:           'notifications',
  COURSES:                 'courses',
  SEMESTERS:               'semesters',
  CLASSES:                 'classes',

};
// ── Generic helpers (Mapped to SQL) ──────────────────────────────────────────

async function getAll(table) {
  const { rows } = await query(`SELECT * FROM ${table}`);
  return rows;
}

async function getById(table, idOrField, id) {
  const field = id === undefined ? 'id' : idOrField;
  const val   = id === undefined ? idOrField : id;
  const { rows } = await query(`SELECT * FROM ${table} WHERE ${field} = $1`, [val]);
  return rows[0] || null;
}

/**
 * findOne / findMany are tricky with SQL using predicates.
 * We'll implement a simplified version that handles common cases (id, employee_id, etc.)
 * For complex queries, controllers should ideally use a specialized query function.
 */
async function findOne(table, predicateOrQuery) {
  if (typeof predicateOrQuery === 'function') {
    // FALLBACK: If a function is passed, we fetch ALL and filter (In-memory, suboptimal)
    // This allows existing code to work while migrating.
    const all = await getAll(table);
    return all.find(predicateOrQuery) || null;
  }
  
  // If it's an object, we build a simple WHERE clause
  const keys = Object.keys(predicateOrQuery);
  const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
  const { rows } = await query(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`, Object.values(predicateOrQuery));
  return rows[0] || null;
}

async function findMany(table, predicateOrQuery) {
  if (typeof predicateOrQuery === 'function') {
    const all = await getAll(table);
    return all.filter(predicateOrQuery);
  }

  const keys = Object.keys(predicateOrQuery);
  if (keys.length === 0) return getAll(table);

  const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
  const { rows } = await query(`SELECT * FROM ${table} WHERE ${where}`, Object.values(predicateOrQuery));
  return rows;
}

async function insert(table, record) {
  const keys   = Object.keys(record);
  const values = Object.values(record);
  const cols   = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await query(sql, values);
  return rows[0];
}

async function update(table, idOrField, idOrChanges, changes) {
  let field, id, finalChanges;
  
  if (changes === undefined) {
    field = 'id';
    id = idOrField;
    finalChanges = idOrChanges;
  } else {
    field = idOrField;
    id = idOrChanges;
    finalChanges = changes;
  }

  const keys = Object.keys(finalChanges);
  if (keys.length === 0) return getById(table, field, id);

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = [id, ...Object.values(finalChanges)];

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${field} = $1 RETURNING *`;
  const { rows } = await query(sql, values);
  return rows[0] || null;
}

async function remove(table, idOrField, id) {
  const field = id === undefined ? 'id' : idOrField;
  const val   = id === undefined ? idOrField : id;
  const { rowCount } = await query(`DELETE FROM ${table} WHERE ${field} = $1`, [val]);
  return rowCount > 0;
}

module.exports = {
  TABLES,
  getAll, getById, findOne, findMany,
  insert, update, remove,
};
