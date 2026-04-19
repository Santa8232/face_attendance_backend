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
const startEnrollment = asyncHandler(async (req, res) => {
  const { employee_id, device_id } = req.body;
  if (!employee_id) return fail(res, 'employee_id is required');

  // Lookup by integer 'id' (primary) or UUID 'employee_id' (legacy/external)
  let emp;
  if (employee_id && typeof employee_id === 'string' && employee_id.includes('-')) {
    emp = await store.findOne(TABLES.EMPLOYEES, { employee_id: employee_id });
  } else {
    emp = await store.getById(TABLES.EMPLOYEES, employee_id);
  }
  
  if (!emp) return fail(res, 'Employee not found', 404);

  // Validate device registration if provided
  if (device_id) {
    const device = await store.findOne(TABLES.DEVICE_REGISTRY, { 
      device_id: device_id, 
      employee_id: emp.id 
    });
    if (device && !device.is_trusted) return fail(res, 'Device is not trusted', 403);
  }

  // Cancel any existing open session
  const existing = await store.findOne(TABLES.ENROLLMENT_SESSIONS, { 
    employee_id: emp.id, 
    status: 'IN_PROGRESS' 
  });
  if (existing) {
    await store.update(TABLES.ENROLLMENT_SESSIONS, existing.id, {
      status: 'CANCELLED',
    });
  }

  const session = await store.insert(TABLES.ENROLLMENT_SESSIONS, {
    enrollment_session_id: `enr_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_${uuidv4().slice(0,6)}`,
    employee_id:  emp.id,
    device_id:    device_id || null,
    initiated_by: req.user.id,
    status:       'IN_PROGRESS',
    sample_count: 0,
    created_at:   new Date().toISOString(),
    completed_at: null,
  });

  return ok(res, {
    id:                    session.id,
    enrollment_session_id: session.enrollment_session_id,
    required_samples:      MAX_ENROLLMENT_SAMPLES,
    instructions:          ENROLLMENT_INSTRUCTIONS,
  }, 'Enrollment session started', 201);
});

// ── 2. Upload a sample ───────────────────────────────────────────────────────
const uploadSample = asyncHandler(async (req, res) => {
  let {
    session_id,
    enrollment_session_id,
    sample_no,
    image_base64,
    face_embedding,
    capture_meta = {},
    quality_score,
    liveness_score,
    pose = {},
  } = req.body;

  const sessionId = req.params.sessionId || session_id || enrollment_session_id;

  if (typeof pose === 'string') {
    try { pose = JSON.parse(pose); } catch (e) {}
  }
  // Flexible capture of face_embedding from various possible sources
  let finalEmbedding = face_embedding || 
                         req.body.embedding || 
                         req.body.face_embedding ||
                         capture_meta?.face_embedding || 
                         capture_meta?.embedding ||
                         (req.body.capture_meta ? JSON.parse(req.body.capture_meta).face_embedding : null);

  if (typeof finalEmbedding === 'string') {
    try { finalEmbedding = JSON.parse(finalEmbedding); } catch (e) {}
  }

  if (req.files) {
    console.log('[DEBUG] uploadSample req.files fields:', req.files.map(f => f.fieldname));
    // Compatibility with existing logic
    if (!req.file && req.files.length > 0) {
      req.file = req.files.find(f => f.fieldname === 'image' || f.fieldname === 'file');
    }
  }

  console.log('[DEBUG] uploadSample req.body keys:', Object.keys(req.body));
  console.log('[DEBUG] finalEmbedding exists:', !!finalEmbedding);

  // Support lookup by integer ID or string session ID
  const session = await store.findOne(TABLES.ENROLLMENT_SESSIONS, 
    !isNaN(parseInt(sessionId)) ? { id: parseInt(sessionId) } : { enrollment_session_id: sessionId }
  );

  if (!session)                          return fail(res, 'Session not found', 404);
  if (session.status !== 'IN_PROGRESS')  return fail(res, 'Session is not in progress');
  if (session.sample_count >= MAX_ENROLLMENT_SAMPLES)
    return fail(res, `Maximum ${MAX_ENROLLMENT_SAMPLES} samples already collected`);

  const hasImage = image_base64 || req.file;
  if (!hasImage) return fail(res, 'image_base64 or image file is required');

  const imageUrl = req.file ? `/uploads/enrollment/${req.file.filename}` : null;
  const sNo = sample_no != null ? parseInt(sample_no) : session.sample_count + 1;

  await store.insert(TABLES.ENROLLMENT_SAMPLES, {
    sample_id:             uuidv4(),
    enrollment_session_id: session.id, // Internal reference
    sample_no:             sNo,
    image_url:             imageUrl,
    image_base64:          image_base64 ? '[stored]' : null,
    quality_score:         quality_score  != null ? parseFloat(quality_score)  : (capture_meta.quality_score || null),
    liveness_score:        liveness_score != null ? parseFloat(liveness_score) : null,
    face_embedding:        finalEmbedding || null,
    yaw:                   pose.yaw   != null ? parseFloat(pose.yaw)   : (capture_meta.yaw || null),
    pitch:                 pose.pitch != null ? parseFloat(pose.pitch) : (capture_meta.pitch || null),
    roll:                  pose.roll  != null ? parseFloat(pose.roll)  : (capture_meta.roll || null),
    created_at:            new Date().toISOString(),
  });

  const newCount = session.sample_count + 1;
  await store.update(TABLES.ENROLLMENT_SESSIONS, session.id, {
    sample_count: newCount,
  });

  return ok(res, {
    id:              session.id,
    sample_no:       sNo,
    samples_received: newCount,
    samples_required: MAX_ENROLLMENT_SAMPLES,
    complete:        newCount >= MAX_ENROLLMENT_SAMPLES,
  }, `Sample ${sNo} received`);
});

// ── 3. Complete enrollment ───────────────────────────────────────────────────
const completeEnrollment = asyncHandler(async (req, res) => {
  const { session_id, enrollment_session_id, aggregate_embedding } = req.body;
  const sessionId = req.params.sessionId || session_id || enrollment_session_id;

  const session = await store.findOne(TABLES.ENROLLMENT_SESSIONS, 
    !isNaN(parseInt(sessionId)) ? { id: parseInt(sessionId) } : { enrollment_session_id: sessionId }
  );

  if (!session)                          return fail(res, 'Session not found', 404);
  if (session.status !== 'IN_PROGRESS')  return fail(res, 'Session is not in progress');

  const samples = await store.findMany(TABLES.ENROLLMENT_SAMPLES, { 
    enrollment_session_id: session.id 
  });
  
  // ── 1. Determine Aggregate Embedding ─────────────────────────────────────
  let finalAggregateEmbedding = aggregate_embedding;
  
  if (typeof finalAggregateEmbedding === 'string') {
    try { finalAggregateEmbedding = JSON.parse(finalAggregateEmbedding); } catch (e) {}
  }

  if (!finalAggregateEmbedding && samples.length > 0) {
    // Aggregate embeddings from samples (simple average)
    const validEmbeddings = samples
      .map(s => {
        if (typeof s.face_embedding === 'string') {
          try { return JSON.parse(s.face_embedding); } catch (e) { return null; }
        }
        return s.face_embedding;
      })
      .filter(e => Array.isArray(e) && e.length > 0);

    if (validEmbeddings.length > 0) {
      const len = validEmbeddings[0].length;
      finalAggregateEmbedding = new Array(len).fill(0);
      for (const emb of validEmbeddings) {
        if (emb.length === len) {
          for (let i = 0; i < len; i++) {
            finalAggregateEmbedding[i] += emb[i];
          }
        }
      }
      for (let i = 0; i < len; i++) {
        finalAggregateEmbedding[i] /= validEmbeddings.length;
      }
    }
  }

  if (!finalAggregateEmbedding) return fail(res, 'No biometric samples or aggregate embedding provided');

  // Deactivate previous templates for this employee
  const templates = await store.findMany(TABLES.FACE_TEMPLATES, { 
    employee_id: session.employee_id, 
    is_active: true 
  });
  for (const t of templates) {
    await store.update(TABLES.FACE_TEMPLATES, t.id, { is_active: false });
  }

  const template = await store.insert(TABLES.FACE_TEMPLATES, {
    template_id:           uuidv4(),
    employee_id:           session.employee_id,
    enrollment_session_id: session.id,
    aggregate_embedding:   JSON.stringify(finalAggregateEmbedding),
    reference_image_url:   samples[0]?.image_url || null,
    sample_count:          samples.length,
    quality_avg:           avg(samples, 'quality_score'),
    liveness_avg:          avg(samples, 'liveness_score'),
    is_active:             true,           // Auto-approve for dev
    approval_status:       'approved_auto',
    created_at:            new Date().toISOString(),
    updated_at:            new Date().toISOString(),
  });

  await store.update(TABLES.ENROLLMENT_SESSIONS, session.id, {
    status:       'COMPLETED',
    completed_at: new Date().toISOString(),
  });

  await store.update(TABLES.EMPLOYEES, session.employee_id, { 
    face_enrolled: true 
  });

  return ok(res, {
    template_id: template.template_id,
    status:      template.approval_status,
  }, 'Enrollment completed and auto-approved for testing');
});

// ── 4. Enrollment Status ─────────────────────────────────────────────────────
const enrollmentStatus = asyncHandler(async (req, res) => {
  const employeeId = req.params.employeeId || req.body.employee_id || req.query.employee_id;
  if (!employeeId) return fail(res, 'employee_id is required');

  let emp;
  if (employeeId && typeof employeeId === 'string' && employeeId.includes('-')) {
    emp = await store.findOne(TABLES.EMPLOYEES, { employee_id: employeeId });
  } else {
    emp = await store.getById(TABLES.EMPLOYEES, employeeId);
  }
  
  if (!emp) return fail(res, 'Employee not found', 404);

  const session = await store.findOne(TABLES.ENROLLMENT_SESSIONS, { 
    employee_id: emp.id, 
    status: 'IN_PROGRESS' 
  });
  const template = await store.findOne(TABLES.FACE_TEMPLATES, { 
    employee_id: emp.id, 
    is_active: true 
  });

  return ok(res, {
    employee_id:   emp.id,
    face_enrolled: emp.face_enrolled,
    active_session: session ? {
      id: session.id,
      samples: session.sample_count,
      started_at: session.created_at,
    } : null,
    template: template ? {
      template_id: template.template_id,
      status:      template.approval_status,
      enrolled_at: template.created_at,
    } : null,
  });
});

// ── 5. Reset Enrollment ──────────────────────────────────────────────────────
const resetEnrollment = asyncHandler(async (req, res) => {
  const employeeId = req.params.employeeId || req.body.employee_id;
  if (!employeeId) return fail(res, 'employee_id is required');

  let emp;
  if (employeeId && typeof employeeId === 'string' && employeeId.includes('-')) {
    emp = await store.findOne(TABLES.EMPLOYEES, { employee_id: employeeId });
  } else {
    emp = await store.getById(TABLES.EMPLOYEES, employeeId);
  }
  
  if (!emp) return fail(res, 'Employee not found', 404);

  // Deactivate templates
  const templates = await store.findMany(TABLES.FACE_TEMPLATES, { employee_id: emp.id });
  for (const t of templates) {
    await store.update(TABLES.FACE_TEMPLATES, t.id, {
      is_active: false, approval_status: 'RESET',
    });
  }

  await store.update(TABLES.EMPLOYEES, emp.id, { face_enrolled: false });

  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id:      uuidv4(),
    actor_user_id: req.user.id,
    actor_role:    req.user.role,
    action_type:   'ENROLLMENT_RESET',
    entity_name:   'employees',
    entity_id:     String(emp.id),
    created_at:    new Date().toISOString(),
  });

  return ok(res, {}, 'Enrollment reset');
});

// ── 6. Approve Template ──────────────────────────────────────────────────────
const approveTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params; // template id (primary key)
  const template = await store.getById(TABLES.FACE_TEMPLATES, id);
  if (!template) return fail(res, 'Template not found', 404);

  await store.update(TABLES.FACE_TEMPLATES, template.id, {
    approval_status: 'approved',
    updated_at: new Date().toISOString(),
  });

  return ok(res, {}, 'Template approved');
});

function avg(arr, key) {
  const vals = arr.map(x => x[key]).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + parseFloat(v), 0) / vals.length : null;
}

module.exports = {
  startEnrollment,
  uploadSample,
  completeEnrollment,
  enrollmentStatus,
  resetEnrollment,
  approveTemplate,
};
