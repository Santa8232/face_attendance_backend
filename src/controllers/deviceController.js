const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');

// ── GET /api/devices ──────────────────────────────────────────────────────────
const listDevices = asyncHandler(async (req, res) => {
  const { employee_id } = req.query;
  let devices = await store.getAll(TABLES.DEVICE_REGISTRY);
  if (employee_id) devices = devices.filter(d => d.employee_id === employee_id);
  if (req.user.role === 'EMPLOYEE') {
    devices = devices.filter(d => d.employee_id === req.user.employee_id);
  }
  return ok(res, devices);
});

// ── POST /api/devices/register ────────────────────────────────────────────────
const registerDevice = asyncHandler(async (req, res) => {
  const {
    employee_id, device_id, device_model, os_version,
    app_version, push_token,
  } = req.body;

  if (!employee_id || !device_id) return fail(res, 'employee_id and device_id are required');

  const existing = await store.findOne(
    TABLES.DEVICE_REGISTRY,
    d => d.device_id === device_id && d.employee_id === employee_id,
  );

  if (existing) {
    const updated = await store.update(TABLES.DEVICE_REGISTRY, 'device_registry_id', existing.device_registry_id, {
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
    employee_id,
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

// ── DELETE /api/devices/:id (untrust) ────────────────────────────────────────
const untrustDevice = asyncHandler(async (req, res) => {
  const device = await store.getById(TABLES.DEVICE_REGISTRY, 'device_registry_id', req.params.id);
  if (!device) return fail(res, 'Device not found', 404);
  await store.update(TABLES.DEVICE_REGISTRY, 'device_registry_id', req.params.id, { is_trusted: false });
  return ok(res, {}, 'Device untrusted');
});

module.exports = { listDevices, registerDevice, untrustDevice };
