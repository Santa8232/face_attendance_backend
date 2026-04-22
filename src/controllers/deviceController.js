const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// ── GET /api/v1/devices ──────────────────────────────────────────────────────────
const listDevices = asyncHandler(async (req, res) => {
  const { employee_id } = req.query;
  const query = {};
  if (employee_id) query.employee_id = parseInt(employee_id);

  if (req.user.role === "EMPLOYEE") {
    query.employee_id = req.user.employee_id;
  }

  const devices = await store.findMany(TABLES.DEVICE_REGISTRY, query);
  return ok(res, devices);
});


// ── POST /api/v1/devices/register ────────────────────────────────────────────────
const registerDevice = asyncHandler(async (req, res) => {
  const {
    employee_id, device_id, device_model, os_version,
    app_version, push_token,
  } = req.body;

  if (!employee_id || !device_id) return fail(res, 'employee_id and device_id are required');
  const empId = parseInt(employee_id);

  const existing = await store.findOne(TABLES.DEVICE_REGISTRY, { 
    device_id, 
    employee_id: empId 
  });

  if (existing) {
    const updated = await store.update(TABLES.DEVICE_REGISTRY, existing.id, {
      device_model: device_model || existing.device_model,
      os_version:   os_version   || existing.os_version,
      app_version:  app_version  || existing.app_version,
      push_token:   push_token   || existing.push_token,
      last_seen_at: new Date().toISOString(),
    });
    return ok(res, updated, 'Device updated');
  }

  const device = await store.insert(TABLES.DEVICE_REGISTRY, {
    device_registry_id: uuidv4(),
    employee_id: empId,
    device_id,
    device_model:  device_model  || null,
    os_version:    os_version    || null,
    app_version:   app_version   || null,
    push_token:    push_token    || null,
    is_trusted:    true,
    trust_score:   1.0,
    registered_at: new Date().toISOString(),
    last_seen_at:  new Date().toISOString(),
  });

  return ok(res, device, 'Device registered', 201);
});

// ── DELETE /api/v1/devices/:id (untrust) ────────────────────────────────────────
const untrustDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const device = await store.getById(TABLES.DEVICE_REGISTRY, id);
  if (!device) return fail(res, 'Device not found', 404);
  await store.update(TABLES.DEVICE_REGISTRY, device.id, { is_trusted: false });
  return ok(res, {}, 'Device untrusted');
});

// ── POST /api/v1/devices/rebind ────────────────────────────────────────────────
const rebindDevice = asyncHandler(async (req, res) => {
  const { employee_id, old_device_id, new_device_id, device_name, reason } = req.body;
  if (!employee_id || !new_device_id)
    return fail(res, 'employee_id and new_device_id are required');

  const empId = parseInt(employee_id);

  // Untrust old device
  if (old_device_id) {
    const old = await store.findOne(TABLES.DEVICE_REGISTRY, { 
      device_id: old_device_id, 
      employee_id: empId 
    });
    if (old) {
      await store.update(TABLES.DEVICE_REGISTRY, old.id, {
        is_trusted: false, trust_score: 0,
      });
    }
  }

  // Register new device
  const device = await store.insert(TABLES.DEVICE_REGISTRY, {
    device_registry_id: uuidv4(),
    employee_id:   empId,
    device_id:     new_device_id,
    device_name:   device_name || null,
    device_model:  req.body.device_model || null,
    os_version:    req.body.os_version   || null,
    app_version:   req.body.app_version  || null,
    push_token:    req.body.push_token   || null,
    is_trusted:    true,
    trust_score:   1.0,
    registered_at: new Date().toISOString(),
    last_seen_at:  new Date().toISOString(),
  });

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id:      uuidv4(),
    actor_user_id: req.user.id,
    actor_role:    req.user.role,
    action_type:   'DEVICE_REBIND',
    entity_name:   'device_registry',
    entity_id:     String(device.id),
    new_value_json: JSON.stringify({ old_device_id, new_device_id, reason }),
    created_at:    new Date().toISOString(),
  });

  return ok(res, device, 'Device rebound successfully');
});

module.exports = { listDevices, registerDevice, rebindDevice, untrustDevice };
