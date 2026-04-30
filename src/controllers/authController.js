const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const store = require("../db/suggested/store_suggested");
const { TABLES } = store;
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/constants");
const { asyncHandler, ok, fail } = require("../utils/helpers");

const REFRESH_SECRET = process.env.REFRESH_SECRET || `${JWT_SECRET}_refresh`;
const REFRESH_EXPIRES = "7d";

const revokedTokens = new Set();

// ── POST /api/v1/auth/login ─────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { username, email, password, device_id, device_name, device_model, os_version, app_version } = req.body;
  const identifier = (username || email || "").toLowerCase().trim();

  if (!identifier || !password)
    return fail(res, "username and password are required");

  // Find user by username
  let user = await store.findOne(TABLES.USERS, { username: identifier });

  // If not found, search teachers by employee_code
  if (!user) {
    let teacher = await store.findOne(TABLES.TEACHERS, {
      employee_code: identifier,
    });
    if (!teacher) {
      teacher = await store.findOne(TABLES.TEACHERS, {
        employee_code: identifier.toUpperCase(),
      });
    }
    if (teacher && teacher.user_id) {
      user = await store.getById(TABLES.USERS, teacher.user_id);
    }
  }

  // If still not found, search students by registration_no
  if (!user) {
    let student = await store.findOne(TABLES.STUDENTS, {
      registration_no: identifier,
    });
    if (!student) {
      student = await store.findOne(TABLES.STUDENTS, {
        registration_no: identifier.toUpperCase(),
      });
    }
    if (student && student.user_id) {
      user = await store.getById(TABLES.USERS, student.user_id);
    }
  }

  if (!user || !user.is_active) {
    return fail(res, "Invalid credentials", 401);
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return fail(res, "Invalid credentials", 401);

  // Get role name
  const roleRecord = await store.getById(TABLES.USER_ROLES, user.user_role_id);
  const roleName = roleRecord ? roleRecord.role_name : null;
  

  // Get profile
  let profile = null;
  if (roleName === 'Student') {
      profile = await store.findOne(TABLES.STUDENTS, { user_id: user.id });
  } else if (roleName === 'Teacher') {
      profile = await store.findOne(TABLES.TEACHERS, { user_id: user.id });
  } else if (roleName === 'Principal') {
      profile = await store.findOne(TABLES.PRINCIPALS, { user_id: user.id });
  }

  // Check face enrollment status
  let faceEnrolled = false;
  const faceEnrollment = await store.findOne(TABLES.FACE_ENROLLMENT, { user_id: user.id });
  if (faceEnrollment && faceEnrollment.enrollment_status === 'Completed') {
      faceEnrolled = true;
  }

  const payload = {
    id: user.id,
    institution_id: user.institution_id,
    username: user.username,
    role: roleName,
    face_enrolled: faceEnrolled || false,
    profile_id: profile?.id || null,
  };

  const access_token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const refresh_token = jwt.sign({ id: user.id }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });

  // Register or update device if provided
  if (device_id) {
    const fullDeviceName = `${device_name || ""} ${device_model || ""}`.trim() || "Unknown Device";
    
    const existing = await store.findOne(TABLES.USER_DEVICES, {
      device_id: device_id,
      user_id: user.id,
    });
    
    const deviceData = {
      user_id: user.id,
      device_id: device_id,
      device_name: fullDeviceName,
      device_os: os_version || "Unknown",
      app_version: app_version || "1.0.0",
      is_approved: 0,
      last_used_at: new Date().toISOString()
    };

    if (!existing) {
      await store.insert(TABLES.USER_DEVICES, deviceData);
    } else {
      await store.update(TABLES.USER_DEVICES, existing.id, {
        device_name: fullDeviceName,
        device_os: os_version || "Unknown",
        app_version: app_version || "1.0.0",
        is_approved: 0,
        last_used_at: new Date().toISOString()
      });
    }
  }

  // Audit
  await store.insert(TABLES.AUDIT_LOGS, {
    user_id: user.id,
    action_type: "LOGIN",
  });
  
  // Login Log
  await store.insert('login_logs', {
    user_id: user.id,
  });

  return ok(
    res,
    {
      access_token,
      refresh_token,
      user: payload,
      profile: profile,
        // institute
        institution: user.institution_id ? await store.getById(TABLES.INSTITUTIONS, user.institution_id) : null,
     
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

  const roleRecord = await store.getById(TABLES.USER_ROLES, user.user_role_id);
  const roleName = roleRecord ? roleRecord.role_name : null;

  let profile = null;
  if (roleName === 'Student') {
      profile = await store.findOne(TABLES.STUDENTS, { user_id: user.id });
  } else if (roleName === 'Teacher') {
      profile = await store.findOne(TABLES.TEACHERS, { user_id: user.id });
  } else if (roleName === 'Principal') {
      profile = await store.findOne(TABLES.PRINCIPALS, { user_id: user.id });
  }

  const payload = {
    id: user.id,
    institution_id: user.institution_id,
    username: user.username,
    role: roleName,
    profile_id: profile?.id || null,
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

  if (req.user && req.user.id) {
    await store.insert(TABLES.AUDIT_LOGS, {
      user_id: req.user.id,
      action_type: "LOGOUT",
    });
  }

  return ok(res, {}, "Logged out successfully");
});

// ── POST /api/v1/auth/register (ADMIN only) ───────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { username, password, full_name, role_name, institution_id } = req.body;
  if (!username || !password || !full_name) return fail(res, "username, password, and full_name are required");

  const existing = await store.findOne(TABLES.USERS, {
    username: username.toLowerCase().trim(),
  });
  if (existing) return fail(res, "Username already in use", 409);

  let roleRecord = null;
  if (role_name) {
    roleRecord = await store.findOne(TABLES.USER_ROLES, { role_name });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await store.insert(TABLES.USERS, {
    username: username.toLowerCase().trim(),
    password_hash: hash,
    full_name,
    user_role_id: roleRecord?.id || null,
    institution_id: institution_id || null,
    is_active: true,
  });

  const { password_hash, ...safeUser } = user;
  return ok(res, safeUser, "User registered", 201);
});

// ── POST /api/v1/auth/change-password ──────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;
  const user = await store.getById(TABLES.USERS, req.user.id);
  if (!user) return fail(res, "User not found", 404);

  const match = await bcrypt.compare(old_password, user.password_hash);
  if (!match) return fail(res, "Current password is incorrect", 401);

  const hash = await bcrypt.hash(new_password, 10);
  await store.update(TABLES.USERS, user.id, { password_hash: hash });

  return ok(res, {}, "Password changed successfully");
});

module.exports = { login, refreshToken, logout, register, changePassword };
