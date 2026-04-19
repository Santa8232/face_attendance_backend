const { v4: uuidv4 } = require('uuid');
const store   = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// ── GET /api/employees ───────────────────────────────────────────────────────
const listEmployees = asyncHandler(async (req, res) => {
  const { office_id, department_id, is_active } = req.query;
  let employees = await store.getAll(TABLES.EMPLOYEES);

  if (office_id)     employees = employees.filter(e => e.office_id     === office_id);
  if (department_id) employees = employees.filter(e => e.department_id === department_id);
  if (is_active !== undefined) {
    const active = is_active === 'true';
    employees = employees.filter(e => e.is_active === active);
  }

  return ok(res, employees);
});

// ── GET /api/employees/:id ───────────────────────────────────────────────────
const getEmployee = asyncHandler(async (req, res) => {
  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', req.params.id);
  if (!emp) return fail(res, 'Employee not found', 404);
  return ok(res, emp);
});

// ── POST /api/employees ──────────────────────────────────────────────────────
const createEmployee = asyncHandler(async (req, res) => {
  const {
    user_id, office_id, department_id, shift_id,
    employee_code, full_name, email, phone,
    designation, employment_type = 'FULL_TIME',
  } = req.body;

  if (!full_name || !email || !office_id) {
    return fail(res, 'full_name, email, and office_id are required');
  }

  const existing = await store.findOne(TABLES.EMPLOYEES, e => e.email === email.toLowerCase());
  if (existing) return fail(res, 'An employee with this email already exists', 409);

  const emp = await store.insert(TABLES.EMPLOYEES, {
    employee_id:     uuidv4(),
    user_id:         user_id || null,
    office_id,
    department_id:   department_id || null,
    shift_id:        shift_id || null,
    employee_code:   employee_code || null,
    full_name,
    email:           email.toLowerCase(),
    phone:           phone || null,
    designation:     designation || null,
    employment_type,
    is_active:       true,
    face_enrolled:   false,
    created_at:      new Date().toISOString(),
  });

  return ok(res, emp, 'Employee created', 201);
});

// ── PUT /api/employees/:id ───────────────────────────────────────────────────
const updateEmployee = asyncHandler(async (req, res) => {
  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', req.params.id);
  if (!emp) return fail(res, 'Employee not found', 404);

  const allowed = [
    'office_id','department_id','shift_id','employee_code',
    'full_name','email','phone','designation','employment_type','is_active',
  ];
  const changes = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) changes[k] = req.body[k]; });

  const updated = await store.update(TABLES.EMPLOYEES, 'employee_id', req.params.id, changes);
  return ok(res, updated, 'Employee updated');
});

// ── DELETE /api/employees/:id (soft-delete) ──────────────────────────────────
const deleteEmployee = asyncHandler(async (req, res) => {
  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', req.params.id);
  if (!emp) return fail(res, 'Employee not found', 404);
  store.update(TABLES.EMPLOYEES, 'employee_id', req.params.id, { is_active: false });
  return ok(res, {}, 'Employee deactivated');
});

// ── GET /api/employees/me ────────────────────────────────────────────────────
const getMyProfile = asyncHandler(async (req, res) => {
  const emp = await store.findOne(TABLES.EMPLOYEES, e => e.user_id === req.user.user_id);
  if (!emp) return fail(res, 'Employee profile not found', 404);
  return ok(res, emp);
});

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, getMyProfile };
