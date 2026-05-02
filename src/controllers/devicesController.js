/**
 * v1 Device Trust Controller
 *
 * POST /api/v1/devices/register  — register new device
 * POST /api/v1/devices/rebind    — rebind device to employee (e.g. after phone change)
 * GET  /api/v1/devices           — list trusted devices
 * DELETE /api/v1/devices/:id     — untrust device
 */

const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// GET /api/v1/devices?employee_id=123
const listDevices = asyncHandler(async (req, res) => {
  const { employee_id } = req.query;
  let devices = await store.getAll(TABLES.DEVICE_REGISTRY);

  if (req.user.role === 'EMPLOYEE') {
    devices = devices.filter(d => d.employee_id === req.user.employee_id);
  } else if (employee_id) {
    devices = devices.filter(d => String(d.employee_id) === String(employee_id));
  }

  return ok(res, devices);
});

// POST /api/v1/devices/register
const registerDevice = asyncHandler(async (req, res) => {
  const { employee_id, device_id, device_name, device_model, os_version, app_version, push_token } = req.body;
  if (!employee_id || !device_id) return fail(res, 'employee_id and device_id are required');

  const existing = await store.findOne(TABLES.DEVICE_REGISTRY,
    d => d.device_id === device_id && String(d.employee_id) === String(employee_id));

  if (existing) {
    const updated = await store.update(TABLES.DEVICE_REGISTRY, 'device_registry_id', existing.device_registry_id, {
      device_name:  device_name  || existing.device_name,
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
    employee_id:   String(employee_id),
    device_id,
    device_name:   device_name   || null,
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

// POST /api/v1/devices/rebind
// Used when employee changes phone — transfers trust to new device_id
const rebindDevice = asyncHandler(async (req, res) => {
  const { employee_id, old_device_id, new_device_id, device_name, reason } = req.body;
  if (!employee_id || !new_device_id)
    return fail(res, 'employee_id and new_device_id are required');

  // Untrust old device
  if (old_device_id) {
    const old = await store.findOne(TABLES.DEVICE_REGISTRY,
      d => d.device_id === old_device_id && String(d.employee_id) === String(employee_id));
    if (old) {
      await store.update(TABLES.DEVICE_REGISTRY, 'device_registry_id', old.device_registry_id, {
        is_trusted: false, trust_score: 0,
      });
    }
  }

  // Register new device
  const device = await store.insert(TABLES.DEVICE_REGISTRY, {
    device_registry_id: uuidv4(),
    employee_id:   String(employee_id),
    device_id:     new_device_id,
    device_name:   device_name || null,
    device_model:  req.body.device_model || null,
    os_version:    req.body.os_version   || null,
    app_version:   req.body.app_version  || null,
    push_token:    req.body.push_token   || null,
    is_trusted:    true,
    trust_score:   1.0,
    rebind_reason: reason || null,
    registered_at: new Date().toISOString(),
    last_seen_at:  new Date().toISOString(),
  });

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id:      uuidv4(),
    actor_user_id: req.user.user_id,
    actor_role:    req.user.role,
    action_type:   'DEVICE_REBIND',
    entity_name:   'device_registry',
    entity_id:     device.device_registry_id,
    new_value_json: JSON.stringify({ old_device_id, new_device_id, reason }),
    created_at:    new Date().toISOString(),
  });

  return ok(res, device, 'Device rebound successfully');
});

// DELETE /api/v1/devices/:id
const untrustDevice = asyncHandler(async (req, res) => {
  const device = await store.getById(TABLES.DEVICE_REGISTRY, 'device_registry_id', req.params.id);
  if (!device) return fail(res, 'Device not found', 404);
  await store.update(TABLES.DEVICE_REGISTRY, 'device_registry_id', req.params.id, {
    is_trusted: false, trust_score: 0,
  });
  return ok(res, {}, 'Device untrusted');
});

module.exports = { listDevices, registerDevice, rebindDevice, untrustDevice };
