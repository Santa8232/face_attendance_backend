const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail, haversineMeters } = require('../utils/helpers');

// ── Offices ───────────────────────────────────────────────────────────────────
const listOffices = asyncHandler(async (req, res) => ok(res, await store.getAll(TABLES.OFFICES)));

const createOffice = asyncHandler(async (req, res) => {
  const { office_name, address, city, country, timezone = 'UTC' } = req.body;
  if (!office_name) return fail(res, 'office_name is required');
  const office = await store.insert(TABLES.OFFICES, {
    office_id: uuidv4(), office_name, address, city, country, timezone,
    is_active: true, created_at: new Date().toISOString(),
  });
  return ok(res, office, 'Office created', 201);
});

const updateOffice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const office = await store.getById(TABLES.OFFICES, id);
  if (!office) return fail(res, 'Office not found', 404);
  const updated = await store.update(TABLES.OFFICES, office.id, req.body);
  return ok(res, updated);
});

// ── Departments ───────────────────────────────────────────────────────────────
const listDepartments = asyncHandler(async (req, res) => {
  const { office_id } = req.query;
  let depts = await store.getAll(TABLES.DEPARTMENTS);
  if (office_id) depts = depts.filter(d => d.office_id === parseInt(office_id));
  return ok(res, depts);
});

const createDepartment = asyncHandler(async (req, res) => {
  const { department_name, office_id } = req.body;
  if (!department_name || !office_id) return fail(res, 'department_name and office_id are required');
  const dept = await store.insert(TABLES.DEPARTMENTS, {
    department_id: uuidv4(), 
    department_name, 
    office_id: parseInt(office_id), 
    created_at: new Date().toISOString(),
  });
  return ok(res, dept, 'Department created', 201);
});

// ── Shifts ────────────────────────────────────────────────────────────────────
const listShifts = asyncHandler(async (req, res) => {
  const { office_id } = req.query;
  let shifts = await store.getAll(TABLES.SHIFTS);
  if (office_id) shifts = shifts.filter(s => s.office_id === parseInt(office_id));
  return ok(res, shifts);
});

const createShift = asyncHandler(async (req, res) => {
  const { office_id, shift_name, start_time, end_time, grace_minutes = 15 } = req.body;
  if (!office_id || !shift_name || !start_time || !end_time)
    return fail(res, 'office_id, shift_name, start_time, end_time are required');
  const shift = await store.insert(TABLES.SHIFTS, {
    shift_id: uuidv4(), 
    office_id: parseInt(office_id), 
    shift_name, start_time, end_time,
    grace_minutes: parseInt(grace_minutes), is_active: true, created_at: new Date().toISOString(),
  });
  return ok(res, shift, 'Shift created', 201);
});

const updateShift = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shift = await store.getById(TABLES.SHIFTS, id);
  if (!shift) return fail(res, 'Shift not found', 404);
  const updated = await store.update(TABLES.SHIFTS, shift.id, req.body);
  return ok(res, updated);
});

// POST /api/v1/shifts/assign
const assignShift = asyncHandler(async (req, res) => {
  const { shift_id, employee_ids = [], office_id } = req.body;
  if (!shift_id) return fail(res, 'shift_id is required');

  const shift = await store.getById(TABLES.SHIFTS, shift_id);
  if (!shift) return fail(res, 'Shift not found', 404);

  const updated = [];
  if (employee_ids.length) {
    for (const eid of employee_ids) {
      const emp = await store.getById(TABLES.EMPLOYEES, eid);
      if (emp) {
        await store.update(TABLES.EMPLOYEES, emp.id, { shift_id: shift.id });
        updated.push(emp.id);
      }
    }
  }

  if (office_id && !employee_ids.length) {
    const officeEmps = await store.findMany(TABLES.EMPLOYEES, { 
      office_id: parseInt(office_id), 
      is_active: true 
    });
    for (const e of officeEmps) {
      await store.update(TABLES.EMPLOYEES, e.id, { shift_id: shift.id });
      updated.push(e.id);
    }
  }

  return ok(res, { shift_id: shift.id, assigned_to: updated, count: updated.length }, 'Shift assigned');
});

// ── Geofences ─────────────────────────────────────────────────────────────────
const listGeofences = asyncHandler(async (req, res) => {
  const { office_id } = req.query;
  let geos = await store.getAll(TABLES.GEOFENCES);
  if (office_id) geos = geos.filter(g => g.office_id === parseInt(office_id));
  return ok(res, geos);
});

const createGeofence = asyncHandler(async (req, res) => {
  const { office_id, geofence_name, latitude, longitude, radius_m } = req.body;
  if (!office_id || !latitude || !longitude || !radius_m)
    return fail(res, 'office_id, latitude, longitude, radius_m are required');
  const geo = await store.insert(TABLES.GEOFENCES, {
    geofence_id: uuidv4(), 
    office_id: parseInt(office_id), 
    geofence_name: geofence_name || 'Office Perimeter',
    latitude: parseFloat(latitude), longitude: parseFloat(longitude),
    radius_m: parseFloat(radius_m), is_active: true, created_at: new Date().toISOString(),
  });
  return ok(res, geo, 'Geofence created', 201);
});

const updateGeofence = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const geo = await store.getById(TABLES.GEOFENCES, id);
  if (!geo) return fail(res, 'Geofence not found', 404);
  const updated = await store.update(TABLES.GEOFENCES, geo.id, req.body);
  return ok(res, updated);
});

const validateGeofence = asyncHandler(async (req, res) => {
  const { office_id, latitude, longitude } = req.body;
  if (!office_id || latitude == null || longitude == null)
    return fail(res, 'office_id, latitude, longitude are required');

  const offId = parseInt(office_id);
  const geos = await store.findMany(TABLES.GEOFENCES, { office_id: offId, is_active: true });

  if (!geos.length) return fail(res, 'No active geofence found for this office', 404);

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  let inside = false;
  let closestGeo = null;
  let closestDist = Infinity;

  for (const geo of geos) {
    const dist = haversineMeters(lat, lon, geo.latitude, geo.longitude);
    if (dist < closestDist) {
      closestDist = dist;
      closestGeo  = geo;
      inside      = dist <= geo.radius_m;
    }
  }

  return ok(res, {
    inside,
    distance_m:    Math.round(closestDist * 10) / 10,
    geofence_name: closestGeo.geofence_name,
    id:            closestGeo.id,
    radius_m:      closestGeo.radius_m,
  });
});

// ── Attendance policies ───────────────────────────────────────────────────────
const getPolicyByOffice = asyncHandler(async (req, res) => {
  const policy = await store.findOne(TABLES.ATTENDANCE_POLICIES, { office_id: parseInt(req.params.officeId) });
  if (!policy) return fail(res, 'Policy not found', 404);
  return ok(res, policy);
});

const upsertPolicy = asyncHandler(async (req, res) => {
  const { office_id } = req.body;
  if (!office_id) return fail(res, 'office_id is required');
  const offId = parseInt(office_id);
  const existing = await store.findOne(TABLES.ATTENDANCE_POLICIES, { office_id: offId });
  if (existing) {
    const updated = await store.update(TABLES.ATTENDANCE_POLICIES, existing.id, req.body);
    return ok(res, updated, 'Policy updated');
  }
  const policy = await store.insert(TABLES.ATTENDANCE_POLICIES, {
    policy_id: uuidv4(), 
    ...req.body, 
    office_id: offId,
    created_at: new Date().toISOString(),
  });
  return ok(res, policy, 'Policy created', 201);
});

// ── Exceptions ────────────────────────────────────────────────────────────────
const listExceptions = asyncHandler(async (req, res) => {
  const { employee_id, status } = req.query;
  let excs = await store.getAll(TABLES.ATTENDANCE_EXCEPTIONS);
  if (employee_id) excs = excs.filter(e => e.employee_id === parseInt(employee_id));
  if (status)      excs = excs.filter(e => e.status      === status);
  if (req.user.role === 'EMPLOYEE') excs = excs.filter(e => e.employee_id === req.user.employee_id);
  return ok(res, excs);
});

const raiseException = asyncHandler(async (req, res) => {
  const { employee_id, exception_type, description, attendance_id } = req.body;
  if (!employee_id || !exception_type) return fail(res, 'employee_id and exception_type are required');
  
  const empId = parseInt(employee_id);
  if (req.user.role === 'EMPLOYEE' && req.user.id !== empId) {
    return fail(res, 'Forbidden', 403);
  }

  const exc = await store.insert(TABLES.ATTENDANCE_EXCEPTIONS, {
    exception_id: uuidv4(), 
    employee_id: empId, 
    attendance_id: attendance_id ? parseInt(attendance_id) : null,
    exception_type, description: description || null, status: 'PENDING',
    reviewed_by: null, reviewed_at: null, review_remarks: null,
    created_at: new Date().toISOString(),
  });
  return ok(res, exc, 'Exception request submitted', 201);
});

const reviewException = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, review_remarks } = req.body;
  const statusUpper = (status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(statusUpper)) return fail(res, 'status must be APPROVED or REJECTED');
  
  const exc = await store.getById(TABLES.ATTENDANCE_EXCEPTIONS, id);
  if (!exc) return fail(res, 'Exception not found', 404);
  
  const updated = await store.update(TABLES.ATTENDANCE_EXCEPTIONS, exc.id, {
    status: statusUpper,
    review_remarks: review_remarks || null,
    reviewed_by:    req.user.id,
    reviewed_at:    new Date().toISOString(),
  });
  return ok(res, updated, `Exception ${statusUpper.toLowerCase()}`);
});

// ── Audit logs ────────────────────────────────────────────────────────────────
const listAuditLogs = asyncHandler(async (req, res) => {
  const { actor_user_id, action_type, from_date, to_date } = req.query;
  let logs = await store.getAll(TABLES.AUDIT_LOGS);
  if (actor_user_id) logs = logs.filter(l => l.actor_user_id === parseInt(actor_user_id));
  if (action_type)   logs = logs.filter(l => l.action_type   === action_type);
  if (from_date)     logs = logs.filter(l => l.created_at >= from_date);
  if (to_date)       logs = logs.filter(l => l.created_at <= to_date + 'T23:59:59Z');
  logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return ok(res, logs);
});

module.exports = {
  listOffices, createOffice, updateOffice,
  listDepartments, createDepartment,
  listShifts, createShift, updateShift, assignShift,
  listGeofences, createGeofence, updateGeofence, validateGeofence,
  getPolicyByOffice, upsertPolicy,
  listExceptions, raiseException, reviewException,
  listAuditLogs,
};
