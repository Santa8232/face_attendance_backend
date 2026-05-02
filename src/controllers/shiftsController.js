/**
 * v1 Shifts & Policies Controller
 *
 * POST /api/v1/shifts              — create shift
 * POST /api/v1/shifts/assign       — assign shift to employee(s)
 * GET  /api/v1/shifts              — list shifts
 * PUT  /api/v1/shifts/:id          — update shift
 * GET  /api/v1/policies/attendance — get office attendance policy
 * POST /api/v1/policies/attendance — upsert policy
 */

const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// ── Shifts ────────────────────────────────────────────────────────────────────

const listShifts = asyncHandler(async (req, res) => {
  const { office_id } = req.query;
  let shifts = await store.getAll(TABLES.SHIFTS);
  if (office_id) shifts = shifts.filter(s => String(s.office_id) === String(office_id));
  return ok(res, shifts);
});

const createShift = asyncHandler(async (req, res) => {
  const { office_id, shift_name, start_time, end_time, grace_minutes = 15 } = req.body;
  if (!office_id || !shift_name || !start_time || !end_time)
    return fail(res, 'office_id, shift_name, start_time, end_time are required');

  const shift = await store.insert(TABLES.SHIFTS, {
    shift_id:      uuidv4(),
    office_id,
    shift_name,
    start_time,
    end_time,
    grace_minutes: parseInt(grace_minutes),
    is_active:     true,
    created_at:    new Date().toISOString(),
  });

  return ok(res, shift, 'Shift created', 201);
});

const updateShift = asyncHandler(async (req, res) => {
  const shift = await store.getById(TABLES.SHIFTS, 'shift_id', req.params.id);
  if (!shift) return fail(res, 'Shift not found', 404);
  const updated = await store.update(TABLES.SHIFTS, 'shift_id', req.params.id, req.body);
  return ok(res, updated, 'Shift updated');
});

// POST /api/v1/shifts/assign
const assignShift = asyncHandler(async (req, res) => {
  const { shift_id, employee_ids = [], office_id } = req.body;
  if (!shift_id) return fail(res, 'shift_id is required');

  const shift = await store.getById(TABLES.SHIFTS, 'shift_id', shift_id);
  if (!shift) return fail(res, 'Shift not found', 404);

  // Assign to specific employees list
  const updated = [];
  if (employee_ids.length) {
    for (const eid of employee_ids) {
      const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', String(eid));
      if (emp) {
        await store.update(TABLES.EMPLOYEES, 'employee_id', String(eid), { shift_id });
        updated.push(String(eid));
      }
    }
  }

  // Or assign to all employees in an office
  if (office_id && !employee_ids.length) {
    const officeEmps = await store.findMany(TABLES.EMPLOYEES,
      e => String(e.office_id) === String(office_id) && e.is_active);
    for (const e of officeEmps) {
      await store.update(TABLES.EMPLOYEES, 'employee_id', e.employee_id, { shift_id });
      updated.push(e.employee_id);
    }
  }

  return ok(res, { shift_id, assigned_to: updated, count: updated.length }, 'Shift assigned');
});

// ── Policies ──────────────────────────────────────────────────────────────────

// GET /api/v1/policies/attendance?office_id=4
const getAttendancePolicy = asyncHandler(async (req, res) => {
  const { office_id } = req.query;
  if (!office_id) return fail(res, 'office_id query param is required');

  const policy = await store.findOne(TABLES.ATTENDANCE_POLICIES,
    p => String(p.office_id) === String(office_id));
  if (!policy) return fail(res, 'No policy found for this office', 404);

  // Map stored fields to spec response shape
  return ok(res, {
    office_id:        policy.office_id,
    check_in_start:   policy.check_in_start   || '08:30',
    check_in_end:     policy.check_in_end     || '10:30',
    grace_minutes:    policy.grace_minutes    ?? 15,
    half_day_after:   policy.half_day_after   || '11:00',
    min_work_minutes: policy.min_work_minutes ?? 420,
    require_geofence: policy.require_geofence ?? true,
    require_liveness: policy.require_liveness ?? true,
    require_face_match: policy.require_face_match ?? true,
    allow_offline:    policy.allow_offline    ?? true,
    max_offline_hours: policy.max_offline_hours ?? 12,
    duplicate_window_sec: policy.duplicate_window_sec ?? 120,
  });
});

// POST /api/v1/policies/attendance  (upsert)
const upsertAttendancePolicy = asyncHandler(async (req, res) => {
  const { office_id } = req.body;
  if (!office_id) return fail(res, 'office_id is required');

  const existing = await store.findOne(TABLES.ATTENDANCE_POLICIES,
    p => String(p.office_id) === String(office_id));

  if (existing) {
    const updated = await store.update(TABLES.ATTENDANCE_POLICIES, 'policy_id', existing.policy_id, req.body);
    return ok(res, updated, 'Policy updated');
  }

  const policy = await store.insert(TABLES.ATTENDANCE_POLICIES, {
    policy_id: uuidv4(), ...req.body, created_at: new Date().toISOString(),
  });
  return ok(res, policy, 'Policy created', 201);
});

module.exports = { listShifts, createShift, updateShift, assignShift, getAttendancePolicy, upsertAttendancePolicy };
