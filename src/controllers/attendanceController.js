/**
 * Attendance Controller  (v1 spec-compliant)
 *
 * Routes:
 *   POST /api/v1/attendance/check-in
 *   POST /api/v1/attendance/check-out
 *   GET  /api/v1/attendance/my?month=YYYY-MM
 *   GET  /api/v1/attendance?office_id=&date=
 *   POST /api/v1/attendance/sync
 *   GET  /api/v1/attendance/today-summary
 *   GET  /api/v1/attendance/daily-summary
 */

const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');
const { FACE_MATCH_THRESHOLD, DUPLICATE_WINDOW_SECONDS, VALID_EVENT_TYPES, MAX_OFFLINE_HOURS } = require('../config/constants');
const { consumeVerificationToken } = require('./faceVerificationController');

// ── Shared: mark attendance ───────────────────────────────────────────────────
async function markAttendance(req, res, eventType) {
  const {
    employee_id,
    device_id,
    verification_token,
    timestamp,
    location = {},
    selfie_image_url,
    network_mode = 'online',
    remarks = null,
    // Legacy direct-score fields (allowed if no verification_token)
    face_match_score,
    liveness_passed,
    liveness_score,
  } = req.body;

  const empId = employee_id || req.user?.employee_id;
  if (!empId) return fail(res, 'employee_id is required');

  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', String(empId));
  if (!emp || !emp.is_active) return fail(res, 'Employee not found or inactive', 404);
  if (!emp.face_enrolled)     return fail(res, 'Employee has no enrolled face template', 400);

  const policy = await store.findOne(TABLES.ATTENDANCE_POLICIES, { office_id: String(emp.office_id) });

  // ── Token OR direct-score path ────────────────────────────────────────────
  let matchScore   = 0;
  let livenessOk   = false;
  let livenessScoreVal = 0;

  if (verification_token) {
    // Preferred path: consume the verification token issued by POST /face/verify
    const tokenPayload = consumeVerificationToken(verification_token);
    if (!tokenPayload) {
      return fail(res, 'verification_token is invalid or expired (tokens are single-use, valid 5 min)');
    }
    if (String(tokenPayload.employee_id) !== String(empId)) {
      return fail(res, 'verification_token does not belong to this employee', 403);
    }
    if (device_id && tokenPayload.device_id && tokenPayload.device_id !== device_id) {
      return fail(res, 'Device mismatch with verification token', 403);
    }
    matchScore       = tokenPayload.confidence;
    livenessScoreVal = tokenPayload.liveness_score;
    livenessOk       = livenessScoreVal >= 0.7;
  } else {
    // Legacy / direct path (useful during development)
    matchScore       = parseFloat(face_match_score) || 0;
    livenessOk       = liveness_passed === true || liveness_passed === 'true';
    livenessScoreVal = parseFloat(liveness_score) || 0;
  }

  // ── Face match threshold ──────────────────────────────────────────────────
  if (policy?.require_face_match !== false && matchScore < FACE_MATCH_THRESHOLD) {
    return fail(res, `Face match failed (confidence ${matchScore.toFixed(3)} < ${FACE_MATCH_THRESHOLD})`);
  }

  // ── Liveness ──────────────────────────────────────────────────────────────
  if (policy?.require_liveness !== false && !livenessOk) {
    return fail(res, 'Liveness check failed');
  }

  // ── Geofence ──────────────────────────────────────────────────────────────
  let geofenceStatus = 'SKIPPED';
  const lat = parseFloat(location.latitude);
  const lon = parseFloat(location.longitude);

  if (policy?.require_geofence !== false && lat && lon) {
    const geofence = await store.findOne(TABLES.GEOFENCES, { 
      office_id: emp.office_id, 
      is_active: true 
    });
    if (geofence) {
      const dist = haversineMeters(lat, lon, geofence.latitude, geofence.longitude);
      geofenceStatus = dist <= geofence.radius_m ? 'INSIDE' : 'OUTSIDE';
      if (geofenceStatus === 'OUTSIDE' && !policy?.allow_field_mode) {
        return fail(res, `Outside geofence (${Math.round(dist)} m from office)`);
      }
    }
  }

  // ── Duplicate prevention ──────────────────────────────────────────────────
  const windowSec = policy?.duplicate_window_sec ?? DUPLICATE_WINDOW_SECONDS;
  const cutoff    = new Date(Date.now() - windowSec * 1000).toISOString();
  const recentDup = await store.findMany(TABLES.ATTENDANCE_LOGS, {
    employee_id: String(empId),
    event_type: eventType,
    // Note: cutoff comparison is still handled in-memory by store.js fallback if we don't add advanced query support,
    // but we can at least pass the equality fields.
    // Actually, store.js findMany only handles equality for now.
    // I will leave the more complex ones as is if they are not the cause of the bug, 
    // but the DailySummary one is critical.
  });
  // Filtering the date in memory for now to keep store.js simple
  const actualDup = recentDup.filter(l => l.event_timestamp > cutoff);
  if (actualDup.length) {
    return fail(res, `Duplicate ${eventType}: already marked within the last ${windowSec}s`);
  }

  // ── Resolve event timestamp ───────────────────────────────────────────────
  const eventTs   = timestamp ? new Date(timestamp) : new Date();
  const now       = new Date();
  const attendanceDate = eventTs.toISOString().slice(0, 10);

  // ── Shift status (on_time / late / early_out) ─────────────────────────────
  const shiftStatus = await resolveShiftStatus(emp, eventType, eventTs);

  // ── Selfie URL ────────────────────────────────────────────────────────────
  const selfieUrl = req.file
    ? `/uploads/attendance/${req.file.filename}`
    : (selfie_image_url || null);

  // ── Persist ───────────────────────────────────────────────────────────────
  const log = await store.insert(TABLES.ATTENDANCE_LOGS, {
    attendance_id:        uuidv4(),
    employee_id:          String(empId),
    office_id:            emp.office_id,
    shift_id:             emp.shift_id || null,
    event_type:           eventType,
    attendance_date:      attendanceDate,
    event_timestamp:      eventTs.toISOString(),
    latitude:             lat  || null,
    longitude:            lon  || null,
    location_accuracy_m:  parseFloat(location.accuracy_m) || null,
    geofence_status:      geofenceStatus,
    face_match_score:     matchScore,
    liveness_score:       livenessScoreVal,
    verification_status:  'APPROVED',
    device_id:            device_id || null,
    network_mode:         network_mode.toUpperCase(),
    offline_flag:         network_mode.toLowerCase() === 'offline',
    selfie_image_url:     selfieUrl,
    shift_status:         shiftStatus,
    remarks,
    created_at:           now.toISOString(),
  });

  await updateDailySummary(String(empId), attendanceDate, eventType, eventTs.toISOString());

  return ok(res, {
    attendance_id: log.attendance_id,
    status:        'present',
    marked_at:     eventTs.toISOString(),
    shift_status:  shiftStatus,
    geofence:      geofenceStatus,
  }, `${eventType} recorded`);
}

// ── POST /api/v1/attendance/check-in ─────────────────────────────────────────
const checkIn  = asyncHandler((req, res) => markAttendance(req, res, 'CHECK_IN'));

// ── POST /api/v1/attendance/check-out ────────────────────────────────────────
const checkOut = asyncHandler((req, res) => markAttendance(req, res, 'CHECK_OUT'));

// ── GET /api/v1/attendance/my?month=YYYY-MM ───────────────────────────────────
const getMyAttendance = asyncHandler(async (req, res) => {
  const { month } = req.query;  // e.g. "2026-04"
  const empId = req.user.employee_id;
  if (!empId) return fail(res, 'No employee profile linked to this account', 404);

  let logs = await store.findMany(TABLES.ATTENDANCE_LOGS, { employee_id: String(empId) });

  if (month) {
    logs = logs.filter(l => {
      const dateStr = l.attendance_date instanceof Date 
        ? l.attendance_date.toISOString().slice(0, 10) 
        : String(l.attendance_date);
      return dateStr.startsWith(month);
    });
  }

  logs.sort((a, b) => {
    const timeA = new Date(a.event_timestamp).getTime();
    const timeB = new Date(b.event_timestamp).getTime();
    return timeB - timeA;
  });

  // Build daily pairs
  const days = {};
  logs.forEach(l => {
    const d = l.attendance_date instanceof Date 
      ? l.attendance_date.toISOString().slice(0, 10) 
      : String(l.attendance_date);
    
    const ts = l.event_timestamp instanceof Date
      ? l.event_timestamp.toISOString()
      : String(l.event_timestamp);

    if (!days[d]) days[d] = { date: d, check_in: null, check_out: null, work_minutes: null };
    if (l.event_type === 'CHECK_IN'  && !days[d].check_in)  days[d].check_in  = ts;
    if (l.event_type === 'CHECK_OUT' && !days[d].check_out) days[d].check_out = ts;
  });

  Object.values(days).forEach(d => {
    if (d.check_in && d.check_out) {
      d.work_minutes = Math.round(
        (new Date(d.check_out) - new Date(d.check_in)) / 60000,
      );
    }
  });

  return ok(res, {
    employee_id: empId,
    month:       month || 'all',
    total_days:  Object.keys(days).length,
    records:     Object.values(days).sort((a, b) => b.date.localeCompare(a.date)),
    raw_logs:    logs,
  });
});

// ── GET /api/v1/attendance ────────────────────────────────────────────────────
const listAttendance = asyncHandler(async (req, res) => {
  const { employee_id, date, from_date, to_date, event_type, office_id, page = 1, limit = 50 } = req.query;

  let logs = await store.getAll(TABLES.ATTENDANCE_LOGS);

  if (req.user.role === 'EMPLOYEE') {
    logs = logs.filter(l => String(l.employee_id) === String(req.user.employee_id));
  } else {
    if (employee_id) logs = logs.filter(l => String(l.employee_id) === String(employee_id));
    if (office_id)   logs = logs.filter(l => l.office_id   === office_id);
  }

  if (event_type) logs = logs.filter(l => l.event_type === event_type.toUpperCase());
  if (date)       logs = logs.filter(l => l.attendance_date === date);
  if (from_date)  logs = logs.filter(l => l.attendance_date >= from_date);
  if (to_date)    logs = logs.filter(l => l.attendance_date <= to_date);

  logs.sort((a, b) => {
    const timeA = new Date(a.event_timestamp).getTime();
    const timeB = new Date(b.event_timestamp).getTime();
    return timeB - timeA;
  });

  const total  = logs.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  return ok(res, {
    total,
    page:    parseInt(page),
    limit:   parseInt(limit),
    records: logs.slice(offset, offset + parseInt(limit)),
  });
});

// ── POST /api/v1/attendance/sync ──────────────────────────────────────────────
const syncOffline = asyncHandler(async (req, res) => {
  const { device_id, events } = req.body;
  if (!Array.isArray(events) || !events.length) return fail(res, 'events array is required');

  const maxHrsDefault = MAX_OFFLINE_HOURS;
  const results = [];

  for (const evt of events) {
    const {
      offline_event_id,
      employee_id,
      event_type,
      timestamp,
      location = {},
      verification_payload = {},
    } = evt;

    const eType = (event_type || '').toUpperCase().replace('-', '_');
    const empId = evt.employee_id || req.user?.employee_id;
    if (!empId || !VALID_EVENT_TYPES.includes(eType)) {
      results.push({ offline_event_id, status: 'REJECTED', reason: 'Invalid employee_id or event_type' });
      continue;
    }

    const ts      = new Date(timestamp);
    const diffHrs = (Date.now() - ts.getTime()) / 3_600_000;

    const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', String(empId));
    const policy = emp ? await store.findOne(TABLES.ATTENDANCE_POLICIES, { office_id: emp.office_id }) : null;
    const maxHrs = policy?.max_offline_hours ?? maxHrsDefault;

    if (diffHrs > maxHrs) {
      results.push({ offline_event_id, status: 'REJECTED', reason: `Offline window exceeded (${diffHrs.toFixed(1)} h > ${maxHrs} h allowed)` });
      await store.insert(TABLES.SYNC_QUEUE, {
        sync_id: uuidv4(), device_id: device_id || null, employee_id: String(empId),
        offline_event_id: offline_event_id || null, sync_status: 'REJECTED',
        synced_at: new Date().toISOString(), error_message: `Offline window exceeded`,
        created_at: new Date().toISOString(),
      });
      continue;
    }

    const dateStr = ts.toISOString().slice(0, 10);
    const log = await store.insert(TABLES.ATTENDANCE_LOGS, {
      attendance_id:       uuidv4(),
      employee_id:         String(empId),
      office_id:           emp?.office_id || null,
      event_type:          eType,
      attendance_date:     dateStr,
      event_timestamp:     ts.toISOString(),
      latitude:            parseFloat(location.latitude)  || null,
      longitude:           parseFloat(location.longitude) || null,
      location_accuracy_m: parseFloat(location.accuracy_m) || null,
      face_match_score:    parseFloat(verification_payload.confidence)     || null,
      liveness_score:      parseFloat(verification_payload.liveness_score) || null,
      device_id:           device_id || evt.device_id || null,
      network_mode:        'OFFLINE',
      offline_flag:        true,
      verification_status: 'APPROVED_OFFLINE',
      created_at:          new Date().toISOString(),
    });

    await store.insert(TABLES.SYNC_QUEUE, {
      sync_id: uuidv4(), device_id: device_id || null, employee_id: String(empId),
      offline_event_id: offline_event_id || null, sync_status: 'SYNCED',
      synced_at: new Date().toISOString(), error_message: null,
      created_at: new Date().toISOString(),
    });

    await updateDailySummary(String(empId), dateStr, eType, ts.toISOString());
    results.push({ offline_event_id, status: 'SYNCED', attendance_id: log.attendance_id });
  }

  return ok(res, { synced: results.filter(r => r.status === 'SYNCED').length, rejected: results.filter(r => r.status === 'REJECTED').length, results }, 'Sync complete');
});

// ── GET /api/v1/attendance/today-summary ─────────────────────────────────────
const todaySummary = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { office_id } = req.query;
  const allLogs = await store.findMany(TABLES.ATTENDANCE_LOGS, l =>
    l.attendance_date === today && (!office_id || l.office_id === office_id),
  );
  const employeeSet = new Set(allLogs.map(l => l.employee_id));
  const checkedIn   = new Set(allLogs.filter(l => l.event_type === 'CHECK_IN').map(l => l.employee_id));
  const checkedOut  = new Set(allLogs.filter(l => l.event_type === 'CHECK_OUT').map(l => l.employee_id));
  const total = (await store.findMany(TABLES.EMPLOYEES, e => e.is_active && (!office_id || e.office_id === office_id))).length;
  return ok(res, {
    date: today, total_employees: total,
    present: employeeSet.size, absent: total - checkedIn.size,
    checked_in: checkedIn.size, checked_out: checkedOut.size,
    still_in_office: checkedIn.size - checkedOut.size,
  });
});

// ── GET /api/v1/attendance/daily-summary ─────────────────────────────────────
const getDailySummary = asyncHandler(async (req, res) => {
  const { employee_id, date, from_date, to_date } = req.query;
  let summaries = await store.getAll(TABLES.ATTENDANCE_SUMMARY);
  if (employee_id) summaries = summaries.filter(s => String(s.employee_id) === String(employee_id));
  if (date)       summaries = summaries.filter(s => s.attendance_date === date);
  if (from_date)  summaries = summaries.filter(s => s.attendance_date >= from_date);
  if (to_date)    summaries = summaries.filter(s => s.attendance_date <= to_date);
  if (req.user.role === 'EMPLOYEE') summaries = summaries.filter(s => String(s.employee_id) === String(req.user.employee_id));
  return ok(res, summaries);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveShiftStatus(emp, eventType, eventTs) {
  if (eventType !== 'CHECK_IN') {
    return eventType === 'CHECK_OUT' ? 'checked_out' : 'unknown';
  }
  if (!emp.shift_id) return 'no_shift';

  const shift = await store.getById(TABLES.SHIFTS, 'shift_id', emp.shift_id);
  if (!shift) return 'no_shift';

  const [sh, sm] = shift.start_time.split(':').map(Number);
  const grace    = shift.grace_minutes ?? 15;

  const shiftStart = new Date(eventTs);
  shiftStart.setHours(sh, sm, 0, 0);

  const diffMin = (eventTs - shiftStart) / 60000;
  if (diffMin <= grace) return 'on_time';
  if (diffMin <= 60)    return 'late';
  return 'very_late';
}

async function updateDailySummary(employeeId, date, eventType, timestamp) {
  const existing = await store.findOne(TABLES.ATTENDANCE_SUMMARY, {
    employee_id: employeeId,
    attendance_date: date
  });

  if (!existing) {
    await store.insert(TABLES.ATTENDANCE_SUMMARY, {
      id: uuidv4(), employee_id: employeeId, attendance_date: date,
      first_check_in:      eventType === 'CHECK_IN'  ? timestamp : null,
      last_check_out:      eventType === 'CHECK_OUT' ? timestamp : null,
      total_work_minutes:  0, day_status: 'PRESENT', created_at: new Date().toISOString(),
    });
  } else {
    const changes = {};
    if (eventType === 'CHECK_IN'  && !existing.first_check_in)  changes.first_check_in  = timestamp;
    if (eventType === 'CHECK_OUT')                               changes.last_check_out  = timestamp;
    if (existing.first_check_in && (changes.last_check_out || existing.last_check_out)) {
      const inTs  = new Date(existing.first_check_in).getTime();
      const outTs = new Date(changes.last_check_out || existing.last_check_out).getTime();
      changes.total_work_minutes = Math.max(0, Math.round((outTs - inTs) / 60000));
    }
    await store.update(TABLES.ATTENDANCE_SUMMARY, 'id', existing.id, changes);
  }
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { checkIn, checkOut, getMyAttendance, listAttendance, syncOffline, todaySummary, getDailySummary };
