const { v4: uuidv4 } = require("uuid");
const store = require("../db/store");
const { TABLES } = store;
const {
  asyncHandler,
  ok,
  fail,
  haversineMeters,
  getISTDate,
  toISTString,
} = require("../utils/helpers");
const {
  FACE_MATCH_THRESHOLD,
  DUPLICATE_WINDOW_SECONDS,
  VALID_EVENT_TYPES,
  MAX_OFFLINE_HOURS,
} = require("../config/constants");
const { consumeVerificationToken } = require("./faceVerificationController");

// ── Shared: mark attendance ───────────────────────────────────────────────────
async function markAttendance(req, res, eventType) {
  const {
    employee_id,
    device_id,
    verification_token,
    timestamp,
    location = {},
    selfie_image_url,
    network_mode = "online",
    remarks = null,
    face_match_score,
    liveness_passed,
    liveness_score,
  } = req.body;

  const empIdOrUuid = employee_id || req.user?.employee_id;
  if (!empIdOrUuid) return fail(res, "employee_id is required");

  // Lookup by integer 'id' (primary) or UUID 'employee_id' (legacy/external)
  let emp;
  if (
    empIdOrUuid &&
    typeof empIdOrUuid === "string" &&
    empIdOrUuid.includes("-")
  ) {
    emp = await store.findOne(TABLES.EMPLOYEES, { employee_id: empIdOrUuid });
  } else {
    emp = await store.getById(TABLES.EMPLOYEES, empIdOrUuid);
  }

  if (!emp || !emp.is_active)
    return fail(res, "Employee not found or inactive", 404);
  if (!emp.face_enrolled)
    return fail(res, "Employee has no enrolled face template", 400);

  const policy = await store.findOne(TABLES.ATTENDANCE_POLICIES, {
    office_id: emp.office_id,
  });

  // ── Token OR direct-score path ────────────────────────────────────────────
  let matchScore = 0;
  let livenessOk = false;
  let livenessScoreVal = 0;

  if (verification_token) {
    const tokenPayload = consumeVerificationToken(verification_token);
    if (!tokenPayload) {
      return fail(res, "verification_token is invalid or expired");
    }
    // Compare integer IDs
    if (tokenPayload.employee_id !== emp.id) {
      return fail(
        res,
        "verification_token does not belong to this employee",
        403,
      );
    }
    matchScore = tokenPayload.confidence;
    livenessScoreVal = tokenPayload.liveness_score;
    livenessOk = livenessScoreVal >= 0.7;
  } else {
    matchScore = parseFloat(face_match_score) || 0;
    livenessOk = liveness_passed === true || liveness_passed === "true";
    livenessScoreVal = parseFloat(liveness_score) || 0;
  }

  if (
    policy?.require_face_match !== false &&
    matchScore < FACE_MATCH_THRESHOLD
  ) {
    return fail(res, `Face match failed (confidence ${matchScore.toFixed(3)})`);
  }
  if (policy?.require_liveness !== false && !livenessOk) {
    return fail(res, "Liveness check failed");
  }

  // ── Geofence ──────────────────────────────────────────────────────────────
  let geofenceStatus = "SKIPPED";
  const lat = parseFloat(location.latitude);
  const lon = parseFloat(location.longitude);

  if (policy?.require_geofence !== false && lat && lon) {
    const geofence = await store.findOne(TABLES.GEOFENCES, {
      office_id: emp.office_id,
      is_active: true,
    });
    if (geofence) {
      const dist = haversineMeters(
        lat,
        lon,
        geofence.latitude,
        geofence.longitude,
      );
      geofenceStatus = dist <= geofence.radius_m ? "INSIDE" : "OUTSIDE";
      if (geofenceStatus === "OUTSIDE" && !policy?.allow_field_mode) {
        return fail(
          res,
          `Outside geofence (${Math.round(dist)} m from office)`,
        );
      }
    }
  }

  // ── Duplicate prevention ──────────────────────────────────────────────────
  const windowSec = policy?.duplicate_window_sec ?? DUPLICATE_WINDOW_SECONDS;
  const cutoffTs = Date.now() - windowSec * 1000;
  const recentLogs = await store.findMany(TABLES.ATTENDANCE_LOGS, {
    employee_id: emp.id,
    event_type: eventType,
  });
  const actualDup = recentLogs.filter(
    (l) => new Date(l.event_timestamp).getTime() > cutoffTs,
  );
  if (actualDup.length) {
    return fail(res, `Duplicate ${eventType}: already marked recently`);
  }

  const eventTs = timestamp ? new Date(timestamp) : new Date();
  const attendanceDate = getISTDate(eventTs);
  const shiftStatus = await resolveShiftStatus(emp, eventType, eventTs);
  const selfieUrl = req.file
    ? `/uploads/attendance/${req.file.filename}`
    : selfie_image_url || null;

  const log = await store.insert(TABLES.ATTENDANCE_LOGS, {
    attendance_id: uuidv4(),
    employee_id: emp.id,
    office_id: emp.office_id,
    shift_id: emp.shift_id || null,
    event_type: eventType,
    attendance_date: attendanceDate,
    event_timestamp: toISTString(eventTs),
    latitude: lat || null,
    longitude: lon || null,
    location_accuracy_m: parseFloat(location.accuracy_m) || null,
    geofence_status: geofenceStatus,
    face_match_score: matchScore,
    liveness_score: livenessScoreVal,
    verification_status: "APPROVED",
    device_id: device_id || null,
    network_mode: network_mode.toUpperCase(),
    offline_flag: network_mode.toLowerCase() === "offline",
    selfie_image_url: selfieUrl,
    shift_status: shiftStatus,
    remarks,
    created_at: toISTString(),
  });

  await updateDailySummary(
    emp.id,
    attendanceDate,
    eventType,
    toISTString(eventTs),
  );

  return ok(
    res,
    {
      id: log.id,
      attendance_id: log.attendance_id,
      status: "present",
      marked_at: toISTString(eventTs),
      shift_status: shiftStatus,
    },
    `${eventType} recorded`,
  );
}

const checkIn = asyncHandler((req, res) =>
  markAttendance(req, res, "CHECK_IN"),
);
const checkOut = asyncHandler((req, res) =>
  markAttendance(req, res, "CHECK_OUT"),
);

const getMyAttendance = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const empId = req.user.employee_id; // JWT still has the integer employee_id as employee_id
  if (!empId) return fail(res, "No employee profile linked", 404);

  let logs = await store.findMany(TABLES.ATTENDANCE_LOGS, {
    employee_id: empId,
  });

  // Format dates to YYYY-MM-DD strings for consistent filtering and grouping
  logs = logs.map((l) => ({
    ...l,
    attendance_date:
      l.attendance_date instanceof Date
        ? getISTDate(l.attendance_date)
        : String(l.attendance_date).slice(0, 10),
  }));

  if (month) {
    logs = logs.filter((l) => l.attendance_date.startsWith(month));
  }

  logs.sort(
    (a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp),
  );

  const days = {};
  logs.forEach((l) => {
    const d = l.attendance_date;
    if (!days[d])
      days[d] = {
        date: d,
        check_in: null,
        check_out: null,
        work_minutes: null,
      };
    if (l.event_type === "CHECK_IN" && !days[d].check_in)
      days[d].check_in = l.event_timestamp;
    if (l.event_type === "CHECK_OUT" && !days[d].check_out)
      days[d].check_out = l.event_timestamp;
  });

  Object.values(days).forEach((d) => {
    if (d.check_in && d.check_out) {
      d.work_minutes = Math.round(
        (new Date(d.check_out) - new Date(d.check_in)) / 60000,
      );
    }
  });

  return ok(res, {
    employee_id: empId,
    month: month || "all",
    records: Object.values(days).sort((a, b) => b.date.localeCompare(a.date)),
  });
});

const listAttendance = asyncHandler(async (req, res) => {
  const {
    employee_id,
    date,
    from_date,
    to_date,
    event_type,
    office_id,
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};
  if (req.user.role === "EMPLOYEE") {
    query.employee_id = req.user.employee_id;
  } else {
    if (employee_id) query.employee_id = parseInt(employee_id);
    if (office_id) query.office_id = parseInt(office_id);
  }

  if (event_type) query.event_type = event_type.toUpperCase();
  if (date) query.attendance_date = date;

  let logs = await store.findMany(TABLES.ATTENDANCE_LOGS, query);

  // Filter by date range if provided
  if (from_date) logs = logs.filter((l) => l.event_timestamp >= from_date);
  if (to_date) logs = logs.filter((l) => l.event_timestamp <= to_date + "T23:59:59Z");

  // Format dates for display
  logs = logs.map((l) => ({
    ...l,
    attendance_date:
      l.attendance_date instanceof Date
        ? getISTDate(l.attendance_date)
        : String(l.attendance_date).slice(0, 10),
  }));

  logs.sort(
    (a, b) => new Date(b.event_timestamp) - new Date(a.event_timestamp),
  );
  const offset = (parseInt(page) - 1) * parseInt(limit);

  return ok(res, {
    total: logs.length,
    page: parseInt(page),
    records: logs.slice(offset, offset + parseInt(limit)),
  });
});

const syncOffline = asyncHandler(async (req, res) => {
  const { device_id, events } = req.body;
  if (!Array.isArray(events) || !events.length)
    return fail(res, "events array is required");

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
    const eType = (event_type || "").toUpperCase().replace("-", "_");
    const empIdOrUuid = employee_id || req.user?.employee_id;

    // Lookup by integer 'id' (primary) or UUID 'employee_id' (legacy/external)
    let emp;
    if (
      empIdOrUuid &&
      typeof empIdOrUuid === "string" &&
      empIdOrUuid.includes("-")
    ) {
      emp = await store.findOne(TABLES.EMPLOYEES, { employee_id: empIdOrUuid });
    } else {
      emp = await store.getById(TABLES.EMPLOYEES, empIdOrUuid);
    }
    if (!emp || !VALID_EVENT_TYPES.includes(eType)) {
      results.push({
        offline_event_id,
        status: "REJECTED",
        reason: "Invalid employee or event type",
      });
      continue;
    }

    const ts = new Date(timestamp);
    const dateStr = getISTDate(ts);
    const log = await store.insert(TABLES.ATTENDANCE_LOGS, {
      attendance_id: uuidv4(),
      employee_id: emp.id,
      office_id: emp.office_id,
      event_type: eType,
      attendance_date: dateStr,
      event_timestamp: toISTString(ts),
      latitude: parseFloat(location.latitude) || null,
      longitude: parseFloat(location.longitude) || null,
      face_match_score: parseFloat(verification_payload.confidence) || null,
      liveness_score: parseFloat(verification_payload.liveness_score) || null,
      device_id: device_id || null,
      network_mode: "OFFLINE",
      offline_flag: true,
      verification_status: "APPROVED_OFFLINE",
      created_at: toISTString(),
    });

    await updateDailySummary(emp.id, dateStr, eType, toISTString(ts));
    results.push({ offline_event_id, status: "SYNCED", id: log.id });
  }

  return ok(res, { results }, "Sync complete");
});

const todaySummary = asyncHandler(async (req, res) => {
  const today = getISTDate();
  const { office_id } = req.query;

  const query = { attendance_date: today };
  if (office_id) query.office_id = parseInt(office_id);

  const logs = await store.findMany(TABLES.ATTENDANCE_LOGS, query);

  const checkedIn = new Set(
    logs.filter((l) => l.event_type === "CHECK_IN").map((l) => l.employee_id),
  );
  const checkedOut = new Set(
    logs.filter((l) => l.event_type === "CHECK_OUT").map((l) => l.employee_id),
  );

  const empQuery = { is_active: true };
  if (office_id) empQuery.office_id = parseInt(office_id);

  const totalEmps = await store.findMany(TABLES.EMPLOYEES, empQuery);
  const total = totalEmps.length;

  return ok(res, {
    date: today,
    total_employees: total,
    present: checkedIn.size,
    absent: total - checkedIn.size,
    checked_in: checkedIn.size,
    checked_out: checkedOut.size,
  });
});

const getDailySummary = asyncHandler(async (req, res) => {
  const { employee_id, date } = req.query;
  const query = {};
  if (employee_id) query.employee_id = parseInt(employee_id);
  if (date) query.attendance_date = date;

  if (req.user.role === "EMPLOYEE") {
    query.employee_id = req.user.employee_id;
  }

  let summaries = await store.findMany(TABLES.ATTENDANCE_SUMMARY, query);

  // Format dates
  summaries = summaries.map((s) => ({
    ...s,
    attendance_date:
      s.attendance_date instanceof Date
        ? getISTDate(s.attendance_date)
        : String(s.attendance_date).slice(0, 10),
  }));

  return ok(res, summaries);
});


// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveShiftStatus(emp, eventType, eventTs) {
  if (eventType !== "CHECK_IN" || !emp.shift_id) return "normal";
  const shift = await store.getById(TABLES.SHIFTS, emp.shift_id);
  if (!shift) return "normal";

  const [sh, sm] = shift.start_time.split(":").map(Number);

  // Calculate exact shift start in IST for the event's IST date
  const istDate = getISTDate(eventTs);
  const shiftStartIST = new Date(
    `${istDate}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00+05:30`,
  );

  const diffMin = (eventTs - shiftStartIST) / 60000;
  if (diffMin <= (shift.grace_minutes || 15)) return "on_time";
  return "late";
}

async function updateDailySummary(employeeId, date, eventType, timestamp) {
  const existing = await store.findOne(TABLES.ATTENDANCE_SUMMARY, {
    employee_id: employeeId,
    attendance_date: date,
  });

  if (!existing) {
    await store.insert(TABLES.ATTENDANCE_SUMMARY, {
      employee_id: employeeId,
      attendance_date: date,
      first_check_in: eventType === "CHECK_IN" ? timestamp : null,
      last_check_out: eventType === "CHECK_OUT" ? timestamp : null,
      total_work_minutes: 0,
      day_status: "PRESENT",
      created_at: toISTString(),
    });
  } else {
    const changes = {};
    if (eventType === "CHECK_IN" && !existing.first_check_in)
      changes.first_check_in = timestamp;
    if (eventType === "CHECK_OUT") changes.last_check_out = timestamp;

    const inTs = changes.first_check_in || existing.first_check_in;
    const outTs = changes.last_check_out || existing.last_check_out;
    if (inTs && outTs) {
      changes.total_work_minutes = Math.max(
        0,
        Math.round((new Date(outTs) - new Date(inTs)) / 60000),
      );
    }
    await store.update(TABLES.ATTENDANCE_SUMMARY, existing.id, changes);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  listAttendance,
  syncOffline,
  todaySummary,
  getDailySummary,
};
