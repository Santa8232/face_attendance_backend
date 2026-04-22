const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const store = require("../db/store");
const { TABLES } = store;
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/constants");
const { asyncHandler, ok, fail } = require("../utils/helpers");

const REFRESH_SECRET = process.env.REFRESH_SECRET || `${JWT_SECRET}_refresh`;
const REFRESH_EXPIRES = "7d";

const revokedTokens = new Set();

// ── POST /api/v1/auth/login ─────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    device_id,
    device_name,
    device_model,
    os_version,
    app_version,
  } = req.body;
  const identifier = (username || email || "").toLowerCase().trim();

  if (!identifier || !password)
    return fail(res, "username/email and password are required");

  // Find user by email or username
  let user = await store.findOne(TABLES.USERS, { email: identifier });
  if (!user) {
    user = await store.findOne(TABLES.USERS, { username: identifier });
  }

  // If still not found, search employees by employee_code
  if (!user) {
    let emp = await store.findOne(TABLES.EMPLOYEES, {
      employee_code: identifier,
    });
    if (!emp) {
      // Try uppercase as fallback for employee codes
      emp = await store.findOne(TABLES.EMPLOYEES, {
        employee_code: identifier.toUpperCase(),
      });
    }

    if (emp && emp.user_id) {
      user = await store.getById(TABLES.USERS, emp.user_id);
    }
  }

  if (!user) {
    return fail(res, "Invalid credentials", 401);
  }

  if (!user.is_active) {
    return fail(res, "Invalid credentials", 401);
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) return fail(res, "Invalid credentials", 401);

  const employee = await store.findOne(TABLES.EMPLOYEES, { user_id: user.id });

  const payload = {
    id: user.id,
    user_id: user.user_id, // UUID
    email: user.email,
    role: user.role,
    employee_id: employee?.id || null,
    employee_uuid: employee?.employee_id || null,
  };

  const access_token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const refresh_token = jwt.sign({ id: user.id }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });

  // Register device if provided
  if (device_id && employee) {
    const existing = await store.findOne(TABLES.DEVICE_REGISTRY, {
      device_id,
      employee_id: employee.id,
    });
    if (existing) {
      await store.update(TABLES.DEVICE_REGISTRY, existing.id, {
        device_name: device_name || existing.device_name,
        device_model: device_model || existing.device_model,
        os_version: os_version || existing.os_version,
        app_version: app_version || existing.app_version,
        last_seen_at: new Date().toISOString(),
      });
    } else {
      await store.insert(TABLES.DEVICE_REGISTRY, {
        device_registry_id: uuidv4(),
        employee_id: employee.id,
        device_id,
        device_name: device_name || null,
        device_model: device_model || null,
        os_version: os_version || null,
        app_version: app_version || null,
        is_trusted: true,
        trust_score: 1.0,
        registered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    }
  }

  // Audit
  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id: uuidv4(),
    actor_user_id: user.id,
    actor_role: user.role,
    action_type: "LOGIN",
    entity_name: "users",
    entity_id: String(user.id),
    created_at: new Date().toISOString(),
  });

  // Fetch geofence for the employee's office
  const geofence = employee
    ? await store.findOne(TABLES.GEOFENCES, {
        office_id: employee.office_id,
        is_active: true,
      })
    : null;

  return ok(
    res,
    {
      access_token,
      refresh_token,
      user: payload,
      employee: employee
        ? {
            id: employee.id,
            employee_code: employee.employee_code,
            full_name: employee.full_name,
            office_id: employee.office_id,
            role: user.role,
            face_enrolled: employee.face_enrolled,
          }
        : null,
      geofence: geofence
        ? {
            id: geofence.id,
            name: geofence.geofence_name,
            latitude: parseFloat(geofence.latitude),
            longitude: parseFloat(geofence.longitude),
            radius_m: geofence.radius_m,
          }
        : null,
    },
    "Login successful",
  );
});

// ── POST /api/v1/auth/refresh ──────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return fail(res, "refresh_token is required");
  if (revokedTokens.has(refresh_token))
    return fail(res, "Token has been revoked", 401);

  let decoded;
  try {
    decoded = jwt.verify(refresh_token, REFRESH_SECRET);
  } catch {
    return fail(res, "Invalid or expired refresh token", 401);
  }

  const user = await store.getById(TABLES.USERS, decoded.id);
  if (!user || !user.is_active)
    return fail(res, "User not found or deactivated", 401);

  const employee = await store.findOne(TABLES.EMPLOYEES, { user_id: user.id });
  const payload = {
    id: user.id,
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    employee_id: employee?.id || null,
    employee_uuid: employee?.employee_id || null,
  };

  const access_token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  return ok(res, { access_token }, "Token refreshed");
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (refresh_token) revokedTokens.add(refresh_token);

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id: uuidv4(),
    actor_user_id: req.user.id,
    actor_role: req.user.role,
    action_type: "LOGOUT",
    entity_name: "users",
    entity_id: String(req.user.id),
    created_at: new Date().toISOString(),
  });

  return ok(res, {}, "Logged out successfully");
});

// ── POST /api/v1/auth/register (ADMIN only) ───────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { email, password, role = "EMPLOYEE", username } = req.body;
  if (!email || !password) return fail(res, "email and password are required");

  const existing = await store.findOne(TABLES.USERS, {
    email: email.toLowerCase().trim(),
  });
  if (existing) return fail(res, "Email already in use", 409);

  const hash = await bcrypt.hash(password, 10);
  const user = await store.insert(TABLES.USERS, {
    user_id: uuidv4(),
    email: email.toLowerCase().trim(),
    username: username || null,
    password: hash,
    role,
    is_active: true,
    created_at: new Date().toISOString(),
  });

  const { password: _, ...safeUser } = user;
  return ok(res, safeUser, "User registered", 201);
});

// ── POST /api/v1/auth/change-password ──────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;
  const user = await store.getById(TABLES.USERS, req.user.id);
  if (!user) return fail(res, "User not found", 404);

  const match = await bcrypt.compare(old_password, user.password);
  if (!match) return fail(res, "Current password is incorrect", 401);

  const hash = await bcrypt.hash(new_password, 10);
  await store.update(TABLES.USERS, user.id, { password: hash });

  return ok(res, {}, "Password changed successfully");
});

module.exports = { login, refreshToken, logout, register, changePassword };
