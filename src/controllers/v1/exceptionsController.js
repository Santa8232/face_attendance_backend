const { v4: uuidv4 } = require('uuid');
const store  = require('../../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../../utils/helpers');

const EXCEPTION_TYPES = [
  'face_mismatch','poor_network','geofence_failure',
  'damaged_camera','emergency_field_duty','device_stolen',
  'manual_correction','other',
];

const raiseException = asyncHandler(async (req, res) => {
  const { employee_id, attendance_id, exception_type, description } = req.body;
  if (!employee_id || !exception_type) return fail(res, 'employee_id and exception_type are required');
  if (!EXCEPTION_TYPES.includes(exception_type))
    return fail(res, `exception_type must be one of: ${EXCEPTION_TYPES.join(', ')}`);

  if (req.user.role === 'EMPLOYEE' && String(req.user.employee_id) !== String(employee_id))
    return fail(res, 'Forbidden', 403);

  const exc = await store.insert(TABLES.ATTENDANCE_EXCEPTIONS, {
    exception_id: uuidv4(), employee_id: String(employee_id),
    attendance_id: attendance_id || null, exception_type,
    description: description || null, status: 'PENDING',
    reviewed_by: null, reviewed_at: null, review_remarks: null,
    created_at: new Date().toISOString(),
  });
  return ok(res, exc, 'Exception raised — pending review', 201);
});

const listExceptions = asyncHandler(async (req, res) => {
  const { employee_id, status, exception_type } = req.query;
  let excs = await store.getAll(TABLES.ATTENDANCE_EXCEPTIONS);
  if (req.user.role === 'EMPLOYEE') excs = excs.filter(e => String(e.employee_id) === String(req.user.employee_id));
  else if (employee_id) excs = excs.filter(e => String(e.employee_id) === String(employee_id));
  if (status)         excs = excs.filter(e => e.status.toLowerCase() === status.toLowerCase());
  if (exception_type) excs = excs.filter(e => e.exception_type === exception_type);
  excs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return ok(res, excs);
});

const reviewException = asyncHandler(async (req, res) => {
  const { exception_id } = req.params;
  const { status, review_remarks } = req.body;
  if (!['APPROVED','REJECTED'].includes((status||'').toUpperCase()))
    return fail(res, 'status must be APPROVED or REJECTED');
  const exc = await store.getById(TABLES.ATTENDANCE_EXCEPTIONS, 'exception_id', exception_id);
  if (!exc) return fail(res, 'Exception not found', 404);
  if (exc.status !== 'PENDING') return fail(res, `Already ${exc.status.toLowerCase()}`);
  const updated = await store.update(TABLES.ATTENDANCE_EXCEPTIONS, 'exception_id', exception_id, {
    status: status.toUpperCase(), review_remarks: review_remarks || null,
    reviewed_by: req.user.user_id, reviewed_at: new Date().toISOString(),
  });
  return ok(res, updated, `Exception ${status.toLowerCase()}`);
});

module.exports = { raiseException, listExceptions, reviewException };
