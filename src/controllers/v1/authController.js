/**
 * v1 Auth Controller
 *
 * Supports:
 *   - Username (employee_code) OR email login
 *   - device_id / device_name capture on login
 *   - Access token (8h) + Refresh token (7d)
 *   - Logout (token invalidation via in-memory denylist)
 *   - OTP request + verify (phone/email — stub ready for SMS/email provider)
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const store  = require('../../db/store');
const { TABLES } = store;
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/constants');
const { asyncHandler, ok, fail } = require('../../utils/helpers');

const REFRESH_SECRET  = process.env.REFRESH_SECRET  || `${JWT_SECRET}_refresh`;
const REFRESH_EXPIRES = '7d';

// Simple in-memory stores (swap for Redis in Phase II)
const revokedTokens = new Set();
const otpStore      = new Map();  // key: employee_id → { otp, expires }

// ── POST /api/v1/auth/login ──────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { username, password, device_id, device_name } = req.body;

  if (!username || !password) return fail(res, 'username and password are required');

  // Find user by email OR employee_code
  const user = await store.findOne(TABLES.USERS, u =>
    u.email === username.toLowerCase().trim() || u.username === username.trim(),
  );

  // Also search employees by employee_code
  let employee = null;
  if (!user) {
    employee = await store.findOne(TABLES.EMPLOYEES, e =>
      e.employee_code?.toLowerCase() === username.toLowerCase().trim(),
    );
    if (!employee) return fail(res, 'Invalid credentials', 401);

    const linkedUser = employee.user_id
      ? await store.getById(TABLES.USERS, 'user_id', employee.user_id)
      : null;
    if (!linkedUser) return fail(res, 'Invalid credentials', 401);

    const match = await bcrypt.compare(password, linkedUser.password);
    if (!match || !linkedUser.is_active) return fail(res, 'Invalid credentials', 401);

    return issueTokens(res, linkedUser, employee, device_id, device_name);
  }

  if (!user.is_active) return fail(res, 'Account deactivated', 401);
  const match = await bcrypt.compare(password, user.password);
  if (!match) return fail(res, 'Invalid credentials', 401);

  employee = await store.findOne(TABLES.EMPLOYEES, e => e.user_id === user.user_id);
  return issueTokens(res, user, employee, device_id, device_name);
});

async function issueTokens(res, user, employee, device_id, device_name) {
  const payload = {
    user_id:     user.user_id,
    email:       user.email,
    role:        user.role,
    employee_id: employee?.employee_id || null,
  };

  const access_token  = jwt.sign(payload, JWT_SECRET,      { expiresIn: JWT_EXPIRES_IN });
  const refresh_token = jwt.sign({ user_id: user.user_id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

  // Register / update device if provided
  if (device_id && employee) {
    const existing = await store.findOne(TABLES.DEVICE_REGISTRY,
      d => d.device_id === device_id && d.employee_id === employee.employee_id);
    if (existing) {
      await store.update(TABLES.DEVICE_REGISTRY, 'device_registry_id', existing.device_registry_id, {
        device_name: device_name || existing.device_name, last_seen_at: new Date().toISOString(),
      });
    } else {
      await store.insert(TABLES.DEVICE_REGISTRY, {
        device_registry_id: uuidv4(), employee_id: employee.employee_id,
        device_id, device_name: device_name || null, device_model: null,
        os_version: null, app_version: null, push_token: null,
        is_trusted: true, trust_score: 1.0,
        registered_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
      });
    }
  }

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id: uuidv4(), actor_user_id: user.user_id, actor_role: user.role,
    action_type: 'LOGIN', entity_name: 'users', entity_id: user.user_id,
    device_id: device_id || null, created_at: new Date().toISOString(),
  });

  return ok(res, {
    access_token,
    refresh_token,
    employee: employee ? {
      employee_id:   employee.employee_id,
      employee_code: employee.employee_code,
      name:          employee.full_name,
      role:          user.role.toLowerCase(),
      office_id:     employee.office_id,
    } : null,
  }, 'Login successful');
}

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return fail(res, 'refresh_token is required');
  if (revokedTokens.has(refresh_token)) return fail(res, 'Token has been revoked', 401);

  let decoded;
  try {
    decoded = jwt.verify(refresh_token, REFRESH_SECRET);
  } catch {
    return fail(res, 'Invalid or expired refresh token', 401);
  }

  const user = await store.getById(TABLES.USERS, 'user_id', decoded.user_id);
  if (!user || !user.is_active) return fail(res, 'User not found or deactivated', 401);

  const employee = await store.findOne(TABLES.EMPLOYEES, e => e.user_id === user.user_id);
  const payload  = { user_id: user.user_id, email: user.email, role: user.role, employee_id: employee?.employee_id || null };
  const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return ok(res, { access_token }, 'Token refreshed');
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (refresh_token) revokedTokens.add(refresh_token);

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id: uuidv4(), actor_user_id: req.user?.user_id || null, actor_role: req.user?.role || null,
    action_type: 'LOGOUT', entity_name: 'users', entity_id: req.user?.user_id || null,
    created_at: new Date().toISOString(),
  });

  return ok(res, {}, 'Logged out successfully');
});

// ── POST /api/v1/auth/request-otp ─────────────────────────────────────────────
const requestOtp = asyncHandler(async (req, res) => {
  const { employee_code, phone } = req.body;
  if (!employee_code && !phone) return fail(res, 'employee_code or phone is required');

  const emp = employee_code
    ? await store.findOne(TABLES.EMPLOYEES, e => e.employee_code?.toLowerCase() === employee_code.toLowerCase())
    : await store.findOne(TABLES.EMPLOYEES, e => e.phone === phone);

  if (!emp) return fail(res, 'Employee not found', 404);

  const otp     = String(Math.floor(100000 + Math.random() * 900000));  // 6-digit
  const expires = Date.now() + 5 * 60 * 1000;  // 5 min
  otpStore.set(emp.employee_id, { otp, expires });

  // TODO: send via SMS/email provider in production
  console.log(`[OTP] Employee ${emp.employee_code}: ${otp}`);

  return ok(res, {
    message: `OTP sent to registered contact (${emp.phone ? emp.phone.slice(0,-4) + '****' : '****'})`,
    expires_in: '5 minutes',
    // Remove in production ↓ (dev convenience only)
    _dev_otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  });
});

// ── POST /api/v1/auth/verify-otp ──────────────────────────────────────────────
const verifyOtp = asyncHandler(async (req, res) => {
  const { employee_code, otp, device_id, device_name } = req.body;
  if (!employee_code || !otp) return fail(res, 'employee_code and otp are required');

  const emp = await store.findOne(TABLES.EMPLOYEES, e =>
    e.employee_code?.toLowerCase() === employee_code.toLowerCase());
  if (!emp) return fail(res, 'Employee not found', 404);

  const stored = otpStore.get(emp.employee_id);
  if (!stored || stored.expires < Date.now()) return fail(res, 'OTP expired or not requested', 401);
  if (stored.otp !== String(otp)) return fail(res, 'Incorrect OTP', 401);

  otpStore.delete(emp.employee_id);  // single-use

  const user = emp.user_id ? await store.getById(TABLES.USERS, 'user_id', emp.user_id) : null;
  if (!user) return fail(res, 'No user account linked to this employee', 404);

  return issueTokens(res, user, emp, device_id, device_name);
});

module.exports = { login, refreshToken, logout, requestOtp, verifyOtp };
