const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const store   = require('../db/store');
const { TABLES } = store;
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');
const { asyncHandler, ok, fail } = require('../utils/helpers');

// ── POST /api/auth/login ─────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return fail(res, 'email and password are required');

  const user = await store.findOne(TABLES.USERS, u => u.email === email.toLowerCase().trim());
  if (!user || !user.is_active) return fail(res, 'Invalid credentials', 401);

  const match = await bcrypt.compare(password, user.password);
  if (!match) return fail(res, 'Invalid credentials', 401);

  // Fetch linked employee record (if any)
  const employee = await store.findOne(TABLES.EMPLOYEES, e => e.user_id === user.user_id);

  const payload = {
    user_id:     user.user_id,
    email:       user.email,
    role:        user.role,
    employee_id: employee?.employee_id || null,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  // Audit
  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id:    uuidv4(),
    actor_user_id: user.user_id,
    actor_role:  user.role,
    action_type: 'LOGIN',
    entity_name: 'users',
    entity_id:   user.user_id,
    created_at:  new Date().toISOString(),
  });

  return ok(res, { token, user: payload }, 'Login successful');
});

// ── POST /api/auth/register  (ADMIN only – via admin routes) ─────────────────
const register = asyncHandler(async (req, res) => {
  const { email, password, role = 'EMPLOYEE' } = req.body;
  if (!email || !password) return fail(res, 'email and password are required');

  const existing = await store.findOne(TABLES.USERS, u => u.email === email.toLowerCase().trim());
  if (existing) return fail(res, 'Email already in use', 409);

  const allowedRoles = ['EMPLOYEE', 'ADMIN', 'HR'];
  if (!allowedRoles.includes(role)) return fail(res, `role must be one of: ${allowedRoles.join(', ')}`);

  const hash = await bcrypt.hash(password, 10);
  const user = await store.insert(TABLES.USERS, {
    user_id:    uuidv4(),
    email:      email.toLowerCase().trim(),
    password:   hash,
    role,
    is_active:  true,
    created_at: new Date().toISOString(),
  });

  const { password: _, ...safeUser } = user;
  return ok(res, safeUser, 'User registered', 201);
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return fail(res, 'old_password and new_password are required');

  const user = await store.getById(TABLES.USERS, 'user_id', req.user.user_id);
  if (!user) return fail(res, 'User not found', 404);

  const match = await bcrypt.compare(old_password, user.password);
  if (!match) return fail(res, 'Current password is incorrect', 401);

  const hash = await bcrypt.hash(new_password, 10);
  await store.update(TABLES.USERS, 'user_id', user.user_id, { password: hash });

  return ok(res, {}, 'Password changed successfully');
});

module.exports = { login, register, changePassword };
