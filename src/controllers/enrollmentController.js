/**
 * Face Enrollment Controller  (v1 spec-compliant)
 *
 * Routes:
 *   POST /api/v1/face/enrollment/start
 *   POST /api/v1/face/enrollment/sample
 *   POST /api/v1/face/enrollment/complete
 *   POST /api/v1/face/enrollment/:template_id/approve   (ADMIN/HR)
 *   POST /api/v1/face/enrollment/:employee_id/reset     (ADMIN)
 *   GET  /api/v1/face/enrollment/:employee_id/status
 */

const { v4: uuidv4 } = require('uuid');
const store  = require('../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../utils/helpers');
const { MAX_ENROLLMENT_SAMPLES } = require('../config/constants');

const ENROLLMENT_INSTRUCTIONS = [
  'Look straight at the camera',
  'Turn your head slightly to the left',
  'Turn your head slightly to the right',
  'Blink naturally when prompted',
  'Keep your face well-lit and unobstructed',
];

// ── 1. Start enrollment session ──────────────────────────────────────────────
// POST /api/v1/face/enrollment/start
const startEnrollment = asyncHandler(async (req, res) => {
  const { employee_id, device_id } = req.body;
  if (!employee_id) return fail(res, 'employee_id is required');

  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', String(employee_id));
  if (!emp) return fail(res, 'Employee not found', 404);

  // Validate device registration if provided
  if (device_id) {
    const device = await store.findOne(TABLES.DEVICE_REGISTRY, { 
      device_id: device_id, 
      employee_id: String(employee_id) 
    });
    if (device && !device.is_trusted) return fail(res, 'Device is not trusted', 403);
  }

  // Cancel any existing open session
  const existing = await store.findOne(TABLES.ENROLLMENT_SESSIONS, { 
    employee_id: String(employee_id), 
    status: 'IN_PROGRESS' 
  });
  if (existing) {
    await store.update(TABLES.ENROLLMENT_SESSIONS, 'enrollment_session_id', existing.enrollment_session_id, {
      status: 'CANCELLED',
    });
  }

  const session = await store.insert(TABLES.ENROLLMENT_SESSIONS, {
    enrollment_session_id: `enr_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_${uuidv4().slice(0,6)}`,
    employee_id:  String(employee_id),
    device_id:    device_id || null,
    initiated_by: req.user.user_id,
    status:       'IN_PROGRESS',
    sample_count: 0,
    created_at:   new Date().toISOString(),
    completed_at: null,
  });

  return ok(res, {
    enrollment_session_id: session.enrollment_session_id,
    required_samples:      MAX_ENROLLMENT_SAMPLES,
    instructions:          ENROLLMENT_INSTRUCTIONS,
  }, 'Enrollment session started', 201);
});

// ── 2. Upload a sample ───────────────────────────────────────────────────────
// POST /api/v1/face/enrollment/sample
const uploadSample = asyncHandler(async (req, res) => {
  const {
    session_id,
    enrollment_session_id,
    sample_no,
    image_base64,
    quality_score,
    liveness_score,
    pose = {},
  } = req.body;

  // Parse JSON strings if they arrive as such (common with multipart/form-data)
  if (typeof pose === 'string') {
    try { pose = JSON.parse(pose); } catch (e) {}
  }

  const sessionId = enrollment_session_id || session_id;
  if (!sessionId) return fail(res, 'enrollment_session_id or session_id is required');

  const session = await store.findOne(TABLES.ENROLLMENT_SESSIONS, { 
    enrollment_session_id: sessionId 
  });
  if (!session)                          return fail(res, 'Session not found', 404);
  if (session.status !== 'IN_PROGRESS')  return fail(res, 'Session is not in progress');
  if (session.sample_count >= MAX_ENROLLMENT_SAMPLES)
    return fail(res, `Maximum ${MAX_ENROLLMENT_SAMPLES} samples already collected`);

  // Accept either base64 or multipart file
  const hasImage = image_base64 || req.file;
  if (!hasImage) return fail(res, 'image_base64 or image file is required');

  const imageUrl = req.file
    ? `/uploads/enrollment/${req.file.filename}`
    : null;  // base64 is stored inline (or to object storage in prod)

  const sNo = sample_no != null ? parseInt(sample_no) : session.sample_count + 1;

  await store.insert(TABLES.ENROLLMENT_SAMPLES, {
    sample_id:             uuidv4(),
    enrollment_session_id: sessionId,
    sample_no:             sNo,
    image_url:             imageUrl,
    image_base64:          image_base64 ? '[stored]' : null,  // don't persist raw b64 in prod
    quality_score:         quality_score  != null ? parseFloat(quality_score)  : null,
    liveness_score:        liveness_score != null ? parseFloat(liveness_score) : null,
    yaw:                   pose.yaw   != null ? parseFloat(pose.yaw)   : null,
    pitch:                 pose.pitch != null ? parseFloat(pose.pitch) : null,
    roll:                  pose.roll  != null ? parseFloat(pose.roll)  : null,
    created_at:            new Date().toISOString(),
  });

  const newCount = session.sample_count + 1;
  await store.update(TABLES.ENROLLMENT_SESSIONS, 'enrollment_session_id', sessionId, {
    sample_count: newCount,
  });

  return ok(res, {
    enrollment_session_id: sessionId,
    sample_no:       sNo,
    samples_received: newCount,
    samples_required: MAX_ENROLLMENT_SAMPLES,
    complete:        newCount >= MAX_ENROLLMENT_SAMPLES,
  }, `Sample ${sNo} received`);
});

// ── 3. Complete enrollment ───────────────────────────────────────────────────
// POST /api/v1/face/enrollment/complete
const completeEnrollment = asyncHandler(async (req, res) => {
  const { session_id, enrollment_session_id } = req.body;
  const sessionId = enrollment_session_id || session_id;
  if (!sessionId) return fail(res, 'enrollment_session_id or session_id is required');

  const session = await store.findOne(TABLES.ENROLLMENT_SESSIONS, { 
    enrollment_session_id: sessionId 
  });
  if (!session)                          return fail(res, 'Session not found', 404);
  if (session.status !== 'IN_PROGRESS')  return fail(res, 'Session is not in progress');

  const samples = await store.findMany(TABLES.ENROLLMENT_SAMPLES, { 
    enrollment_session_id: sessionId 
  });
  if (!samples.length) return fail(res, 'No samples uploaded yet');

  // Deactivate previous template
  const prev = await store.findOne(TABLES.FACE_TEMPLATES, { 
    employee_id: String(session.employee_id), 
    is_active: true 
  });
  if (prev) await store.update(TABLES.FACE_TEMPLATES, 'template_id', prev.template_id, { is_active: false });

  const template = await store.insert(TABLES.FACE_TEMPLATES, {
    template_id:           uuidv4(),
    employee_id:           session.employee_id,
    enrollment_session_id: sessionId,
    aggregate_embedding:   req.body.aggregate_embedding ? JSON.stringify(req.body.aggregate_embedding) : null,
    reference_image_url:   samples[0]?.image_url || null,
    sample_count:          samples.length,
    quality_avg:           avg(samples, 'quality_score'),
    liveness_avg:          avg(samples, 'liveness_score'),
    is_active:             false,          // awaits approval
    approval_status:       'PENDING_APPROVAL',
    created_at:            new Date().toISOString(),
  });

  await store.update(TABLES.ENROLLMENT_SESSIONS, 'enrollment_session_id', sessionId, {
    status:       'COMPLETED',
    completed_at: new Date().toISOString(),
  });

  // AUTO-APPROVE for Development/Phase I testing
  // In production, this should stay false and require admin approval
  await store.update(TABLES.FACE_TEMPLATES, 'template_id', template.template_id, {
    is_active:       true,
    approval_status: 'APPROVED',
    approved_at:     new Date().toISOString(),
  });

  await store.update(TABLES.EMPLOYEES, 'employee_id', session.employee_id, { 
    face_enrolled: true 
  });

  return ok(res, {
    template_id: template.template_id,
    status:      'approved_auto',
  }, 'Enrollment completed and auto-approved for testing');
});

// ── 4. Approve enrollment (ADMIN / HR) ───────────────────────────────────────
// POST /api/v1/face/enrollment/:template_id/approve
const approveEnrollment = asyncHandler(async (req, res) => {
  const { template_id } = req.params;
  const template = await store.getById(TABLES.FACE_TEMPLATES, 'template_id', template_id);
  if (!template) return fail(res, 'Template not found', 404);

  if (template.approval_status === 'APPROVED') {
    return fail(res, 'Template is already approved');
  }

  await store.update(TABLES.FACE_TEMPLATES, 'template_id', template_id, {
    is_active:       true,
    approval_status: 'APPROVED',
    approved_by:     req.user.user_id,
    approved_at:     new Date().toISOString(),
  });

  await store.update(TABLES.EMPLOYEES, 'employee_id', template.employee_id, { face_enrolled: true });

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id:      uuidv4(),
    actor_user_id: req.user.user_id,
    actor_role:    req.user.role,
    action_type:   'ENROLLMENT_APPROVED',
    entity_name:   'face_templates',
    entity_id:     template_id,
    created_at:    new Date().toISOString(),
  });

  return ok(res, { template_id, status: 'approved' }, 'Enrollment approved');
});

// ── 5. Reset enrollment (ADMIN) ──────────────────────────────────────────────
// POST /api/v1/face/enrollment/:employee_id/reset
const resetEnrollment = asyncHandler(async (req, res) => {
  const { employee_id } = req.params;
  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', employee_id);
  if (!emp) return fail(res, 'Employee not found', 404);

  const templates = await store.findMany(TABLES.FACE_TEMPLATES, t => String(t.employee_id) === employee_id);
  for (const t of templates) {
    await store.update(TABLES.FACE_TEMPLATES, 'template_id', t.template_id, {
      is_active: false, approval_status: 'RESET',
    });
  }

  await store.update(TABLES.EMPLOYEES, 'employee_id', employee_id, { face_enrolled: false });

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id:      uuidv4(),
    actor_user_id: req.user.user_id,
    actor_role:    req.user.role,
    action_type:   'ENROLLMENT_RESET',
    entity_name:   'employees',
    entity_id:     employee_id,
    created_at:    new Date().toISOString(),
  });

  return ok(res, {}, 'Enrollment reset — employee must re-enroll');
});

// ── 6. Enrollment status ──────────────────────────────────────────────────────
// GET /api/v1/face/enrollment/:employee_id/status
const enrollmentStatus = asyncHandler(async (req, res) => {
  const { employee_id } = req.params;
  const emp = await store.getById(TABLES.EMPLOYEES, 'employee_id', employee_id);
  if (!emp) return fail(res, 'Employee not found', 404);

  const template = await store.findOne(
    TABLES.FACE_TEMPLATES,
    t => String(t.employee_id) === employee_id,
  );

  return ok(res, {
    face_enrolled:    emp.face_enrolled,
    template_id:      template?.template_id    || null,
    approval_status:  template?.approval_status || null,
    sample_count:     template?.sample_count    || 0,
    enrolled_at:      template?.created_at      || null,
    approved_at:      template?.approved_at     || null,
  });
});

function avg(arr, key) {
  const vals = arr.map(x => x[key]).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + parseFloat(v), 0) / vals.length : null;
}

module.exports = {
  startEnrollment,
  uploadSample,
  completeEnrollment,
  approveEnrollment,
  resetEnrollment,
  enrollmentStatus,
};
