const { v4: uuidv4 } = require("uuid");
const store = require("../db/store");
const { TABLES } = store;
const { asyncHandler, ok, fail, toISTString } = require("../utils/helpers");
const { FACE_MATCH_THRESHOLD } = require("../config/constants");

const verificationTokens = new Map();
const TOKEN_TTL_MS = 5 * 60 * 1000;

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, mA = 0, mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

// ── POST /api/v1/face/verify ─────────────────────────────────────────────────
const verifyFace = asyncHandler(async (req, res) => {
  let {
    employee_id,
    device_id,
    image_base64,
    capture_meta = {},
    liveness_meta = {},
  } = req.body;

  if (typeof capture_meta === 'string') {
    try { capture_meta = JSON.parse(capture_meta); } catch (e) { capture_meta = {}; }
  }
  if (typeof liveness_meta === 'string') {
    try { liveness_meta = JSON.parse(liveness_meta); } catch (e) { liveness_meta = {}; }
  }

  // Fallback for face_embedding if it's not in capture_meta but in root body
  const currentEmbedding = capture_meta?.face_embedding || capture_meta?.embedding || req.body.face_embedding || req.body.embedding;
  if (currentEmbedding && !capture_meta.face_embedding) {
    capture_meta.face_embedding = currentEmbedding;
  }

  const empIdOrUuid = employee_id || req.user?.employee_id;
  if (!empIdOrUuid) return fail(res, "employee_id is required");
  
  if (req.files) {
    console.log('[DEBUG] verifyFace req.files fields:', req.files.map(f => f.fieldname));
    if (!req.file && req.files.length > 0) {
      req.file = req.files.find(f => f.fieldname === 'image' || f.fieldname === 'file');
    }
  }

  if (!image_base64 && !req.file)
    return fail(res, "image_base64 or image file is required");

  console.log('[DEBUG] verifyFace req.body keys:', Object.keys(req.body));
  console.log('[DEBUG] face_embedding detected:', !!capture_meta?.face_embedding);

  // Lookup by integer 'id' (primary) or UUID 'employee_id' (legacy/external)
  let emp;
  if (empIdOrUuid && typeof empIdOrUuid === 'string' && empIdOrUuid.includes('-')) {
    emp = await store.findOne(TABLES.EMPLOYEES, { employee_id: empIdOrUuid });
  } else {
    emp = await store.getById(TABLES.EMPLOYEES, empIdOrUuid);
  }
  if (!emp || !emp.is_active)
    return fail(res, "Employee not found or inactive", 404);
  if (!emp.face_enrolled)
    return fail(res, "Employee has no enrolled face template", 400);

  const template = await store.findOne(TABLES.FACE_TEMPLATES, { 
    employee_id: emp.id, 
    is_active: true 
  });
  if (!template) return fail(res, "No active face template found", 404);

  // ── Validate Biometric Matching ─────────────────────────────────────
  let matchScore = 0;
  let matched = false;

  if (capture_meta.face_embedding && (template.aggregate_embedding || template.face_embedding)) {
    const enrolledEmbeddingRaw = template.aggregate_embedding || template.face_embedding;
    const enrolledEmbedding = typeof enrolledEmbeddingRaw === 'string' 
      ? JSON.parse(enrolledEmbeddingRaw) 
      : enrolledEmbeddingRaw;
    
    matchScore = cosineSimilarity(capture_meta.face_embedding, enrolledEmbedding);
    matched = matchScore >= FACE_MATCH_THRESHOLD;
    
    console.log(`[BIOMETRIC] Employee: ${emp.id}`);
    console.log(`[BIOMETRIC] Similarity: ${matchScore.toFixed(4)} (Threshold: ${FACE_MATCH_THRESHOLD})`);
    console.log(`[BIOMETRIC] Result: ${matched ? 'MATCH' : 'NO MATCH'}`);
  } else {
    console.warn(`[SECURITY] Verification attempted without embeddings for employee: ${emp.id}`);
    return fail(res, 'Biometric data missing. Please re-enroll.', 401);
  }

  const livenessScore = parseFloat(liveness_meta.liveness_score ?? 0);

  // Risk flag checks
  const riskFlags = [];
  if (capture_meta.blur_score != null && capture_meta.blur_score > 0.5)
    riskFlags.push("BLURRY_IMAGE");
  if (capture_meta.brightness != null && capture_meta.brightness < 0.2)
    riskFlags.push("LOW_BRIGHTNESS");
  if (Math.abs(capture_meta.yaw ?? 0) > 20) riskFlags.push("EXCESSIVE_YAW");
  if (Math.abs(capture_meta.pitch ?? 0) > 15) riskFlags.push("EXCESSIVE_PITCH");

  const isFinalMatch = matched && livenessScore >= 0.7;

  if (!isFinalMatch) {
    return fail(
      res,
      `Face verification failed (similarity: ${matchScore.toFixed(3)}, liveness: ${livenessScore.toFixed(3)})`,
    );
  }

  // ── Issue short-lived verification token ─────────────────────────────────
  const token = `fvt_${uuidv4().replace(/-/g, "")}`;
  verificationTokens.set(token, {
    employee_id: emp.id,
    template_id: template.id,
    confidence: matchScore,
    liveness_score: livenessScore,
    device_id: device_id || null,
    issued_at: Date.now(),
  });

  // Auto-expire token
  setTimeout(() => verificationTokens.delete(token), TOKEN_TTL_MS);

  // Audit
  await store.insert(TABLES.AUDIT_LOGS, {
    audit_id: uuidv4(),
    actor_user_id: req.user?.id || null,
    actor_role: req.user?.role || null,
    action_type: "FACE_VERIFY",
    entity_name: "face_templates",
    entity_id: String(template.id),
    new_value_json: JSON.stringify({
      matched,
      match_score: matchScore,
      risk_flags: riskFlags,
    }),
    device_id: device_id || null,
    created_at: toISTString(),
  });

  return ok(
    res,
    {
      matched,
      confidence: matchScore,
      id: template.id,
      risk_flags: riskFlags,
      verification_token: token,
      token_expires_in: `${TOKEN_TTL_MS / 60000} minutes`,
    },
    "Face verified",
  );
});

function consumeVerificationToken(token) {
  const payload = verificationTokens.get(token);
  if (!payload) return null;

  const age = Date.now() - payload.issued_at;
  if (age > TOKEN_TTL_MS) {
    verificationTokens.delete(token);
    return null;
  }

  verificationTokens.delete(token); // single-use
  return payload;
}

module.exports = { verifyFace, consumeVerificationToken };
