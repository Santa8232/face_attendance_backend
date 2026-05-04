
const store = require("../db/store");
const { TABLES } = store;
const { asyncHandler, ok, fail, getISTDate, toISTString } = require('../utils/helpers');

// ── 1. Start enrollment session ──────────────────────────────────────────────
const startEnrollment = asyncHandler(async (req, res) => {
  const { user_id,role,institution_id } = req.body;
  
  if (!user_id || !role || !institution_id) return fail(res, 'user_id, role and institution_id are required');
  // check if the id are 0 that is invalid
  if(user_id === 0 || institution_id === 0 || role === 0) return fail(res, 'user_id, role or institution_id is/are invalid');

  const existing = await store.findOne(TABLES.FACE_ENROLLMENT, { 
    user_id: user_id, 
  });

  if(existing){
    if(existing.enrollment_status === 'COMPLETED'){
      return ok(res, {is_enrolled: true, enrollment_id: existing.id}, 'Already enrolled', 200); 
    }
   //return data in json format 
   return ok(res, existing, 'Enrollment session already started', 200); 
  }

  //if exist


  // // Create face enrollment
  const insertData = {
    user_id: user_id, 
    institution_id: institution_id,
    enrollment_status: 'IN_PROGRESS', 
    enrollment_date: getISTDate(), 
    enrolled_by_user_id: req.user.id,
    is_active: true,
  };

  const enrollment = await store.insert(TABLES.FACE_ENROLLMENT, insertData);

  return ok(res, enrollment, 'Enrollment session started', 201);
});

// ── 2. Upload a sample ───────────────────────────────────────────────────────
const uploadEmbedded = asyncHandler(async (req, res) => {
  let {
    session_id,
    enrollment_session_id,
    face_enrollment_id,
    image_no,
    image_base64,
    face_embedding,
    capture_meta = {},
    quality_score,
    liveness_score,
    pose = {},
    device_info = {},
  } = req.body;

  if (typeof pose === 'string') {
    try { pose = JSON.parse(pose); } catch (e) {}
  }
  if (typeof device_info === 'string') {
    try { device_info = JSON.parse(device_info); } catch (e) {}
  }
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
    console.log('[DEBUG] uploadEmbedded req.files fields:', req.files.map(f => f.fieldname));
    // Compatibility with existing logic
    if (!req.file && req.files.length > 0) {
      req.file = req.files.find(f => f.fieldname === 'image' || f.fieldname === 'file');
    }
  }

  console.log('[DEBUG] uploadEmbedded req.body keys:', Object.keys(req.body));
  console.log('[DEBUG] finalEmbedding exists:', !!finalEmbedding);

  const sessionId = req.params.sessionId || req.params.id || face_enrollment_id || session_id || enrollment_session_id;
  
  if (!sessionId) return fail(res, 'sessionId is required');

  // Support lookup by integer ID
  const session = await store.getById(TABLES.FACE_ENROLLMENT, sessionId);

  if (!session)                          return fail(res, 'Session not found', 404);
  if (session.enrollment_status !== 'IN_PROGRESS')  return fail(res, 'Session is not in progress');



  // ── 1. Store Embedding (if provided) ──────────────────────────────────────
  if (finalEmbedding && Array.isArray(finalEmbedding)) {
    await store.insert(TABLES.FACE_EMBEDDING, {
      face_enrollment_id:   session.id,
      user_id:              session.user_id,
      embedding_vector:     `[${finalEmbedding.join(',')}]`,
      model_name:           req.body.model_name || 'FaceNet',
      model_version:        req.body.model_version || '1.0',
      is_active:            true,
      created_at:           toISTString(),
    });
  }

  return ok(res, {
    face_enrollment_id: session.id,
    embedding_stored: !!finalEmbedding
  }, `Data received for session ${sessionId}`);
});

// ── 3. Complete enrollment ───────────────────────────────────────────────────
const completeEnrollment = asyncHandler(async (req, res) => {
  const { session_id, enrollment_session_id, face_enrollment_id, aggregate_embedding } = req.body;
  const sessionId = req.params.sessionId || req.params.id || face_enrollment_id || session_id || enrollment_session_id;

  if (!sessionId) return fail(res, 'sessionId is required');

  const session = await store.getById(TABLES.FACE_ENROLLMENT, sessionId);

  if (!session)                          return fail(res, 'Session not found', 404);
  if (session.enrollment_status !== 'IN_PROGRESS')  return fail(res, 'Session is not in progress');


  
  // ── 1. Determine Aggregate Embedding ─────────────────────────────────────
  let finalAggregateEmbedding = aggregate_embedding;
  
  if (typeof finalAggregateEmbedding === 'string') {
    try { finalAggregateEmbedding = JSON.parse(finalAggregateEmbedding); } catch (e) {}
  }

  // (Optional logic to average embeddings if not provided could go here, 
  // but usually sent from frontend)

  if (!finalAggregateEmbedding) return fail(res, 'No aggregate embedding provided');

  // Deactivate previous templates for this user
  const templates = await store.findMany(TABLES.FACE_EMBEDDING, { 
    user_id: session.user_id, 
    is_active: true 
  });
  for (const t of templates) {
    await store.update(TABLES.FACE_EMBEDDING, t.id, { is_active: false });
  }

  // Insert into face_embedding (VECTOR type)
  // We pass the array as a string for Postgres to parse as a vector
  const embedding = await store.insert(TABLES.FACE_EMBEDDING, {
    face_enrollment_id:   session.id,
    user_id:              session.user_id,
    embedding_vector:     `[${finalAggregateEmbedding.join(',')}]`,
    model_name:           'FaceNet', // Default or from config
    is_active:            true,
    created_at:           toISTString(),
  });

  await store.update(TABLES.FACE_ENROLLMENT, session.id, {
    enrollment_status: 'COMPLETED',
  });

  return ok(res, {
    embedding_id: embedding.id,
    status:       'COMPLETED',
  }, 'Enrollment completed');
});

// ── 4. Enrollment Status ─────────────────────────────────────────────────────
const enrollmentStatus = asyncHandler(async (req, res) => {
  const userId = req.params.employeeId || req.params.employee_id || req.params.id || req.body.user_id || req.query.user_id;
  if (!userId) return fail(res, 'user_id is required');

  const enrollment = await store.findOne(TABLES.FACE_ENROLLMENT, { 
    user_id: userId 
  });
  const embedding = await store.findOne(TABLES.FACE_EMBEDDING, { 
    user_id: userId, 
    is_active: true 
  });

  return ok(res, {
    user_id:       userId,
    is_enrolled:   enrollment?.enrollment_status === 'COMPLETED',
    active_session: enrollment?.enrollment_status === 'IN_PROGRESS' ? {
      id: enrollment.id,
      started_at: enrollment.enrollment_date,
    } : null,
    embedding: embedding ? {
      id:          embedding.id,
      enrolled_at: embedding.created_at,
    } : null,
  });
});

// ── 5. Reset Enrollment ──────────────────────────────────────────────────────
const resetEnrollment = asyncHandler(async (req, res) => {
  const userId = req.params.employeeId || req.params.employee_id || req.params.id || req.body.user_id;
  if (!userId) return fail(res, 'user_id is required');

  // Deactivate embeddings
  const embeddings = await store.findMany(TABLES.FACE_EMBEDDING, { user_id: userId });
  for (const e of embeddings) {
    await store.update(TABLES.FACE_EMBEDDING, e.id, {
      is_active: false,
    });
  }

  // Update enrollment status
  const enrollment = await store.findOne(TABLES.FACE_ENROLLMENT, { user_id: userId });
  if (enrollment) {
    await store.update(TABLES.FACE_ENROLLMENT, enrollment.id, {
      enrollment_status: 'RESET',
      is_active: false
    });
  }

  await store.insert(TABLES.AUDIT_LOGS, {
    user_id:       req.user.id,
    action_type:   'ENROLLMENT_RESET',
    table_name:    'face_enrollment',
    record_id:     String(userId),
    created_at:    toISTString(),
  });

  return ok(res, {}, 'Enrollment reset');
});

// ── 6. Approve Template ──────────────────────────────────────────────────────
const approveTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params; // embedding id
  const embedding = await store.getById(TABLES.FACE_EMBEDDING, id);
  if (!embedding) return fail(res, 'Embedding not found', 404);

  await store.update(TABLES.FACE_EMBEDDING, embedding.id, {
    is_active: true,
  });

  return ok(res, {}, 'Template approved');
});

function avg(arr, key) {
  const vals = arr.map(x => x[key]).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + parseFloat(v), 0) / vals.length : null;
}

module.exports = {
  startEnrollment,
  uploadEmbedded,
  completeEnrollment,
  enrollmentStatus,
  resetEnrollment,
  approveTemplate,
};
