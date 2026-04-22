/**
 * Face Attendance Backend – Entry Point
 * Node.js / Express  |  JSON file store (swap for DB later)
 */

const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const fs            = require('fs');
const swaggerUi     = require('swagger-ui-express');
const swaggerSpec   = require('./config/swagger');

const { PORT, UPLOAD_DIR } = require('./config/constants');

// ── Routes (v1 spec-compliant) ────────────────────────────────────────────────
const v1AuthRoutes       = require('./routes/v1/authRoutes');
const v1EmployeeRoutes   = require('./routes/v1/employeeRoutes');
const v1FaceRoutes       = require('./routes/v1/faceRoutes');
const v1AttendanceRoutes = require('./routes/v1/attendanceRoutes');
const v1ShiftsRoutes     = require('./routes/v1/shiftsRoutes');
const v1PoliciesRoutes   = require('./routes/v1/policiesRoutes');
const v1GeofenceRoutes   = require('./routes/v1/geofenceRoutes');
const v1DevicesRoutes    = require('./routes/v1/devicesRoutes');
const v1ExceptionsRoutes = require('./routes/v1/exceptionsRoutes');
const v1ReportsRoutes    = require('./routes/v1/reportsRoutes');
const loggerMiddleware   = require('./middleware/logger');

const app = express();

// ── Global middleware ──────────────────────────────────────────────────────────
app.use(loggerMiddleware);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
const uploadRoot = path.join(__dirname, '..', UPLOAD_DIR);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
app.use('/uploads', express.static(uploadRoot));

// ── Swagger UI ───────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Face Attendance API Docs',
  customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'Face Attendance API',
    time:    new Date().toISOString(),
  });
});

// ── v1 routes (spec-compliant) ────────────────────────────────────────────────
app.use('/api/v1/auth',        v1AuthRoutes);
app.use('/api/v1/employees',   v1EmployeeRoutes);
app.use('/api/v1/face',        v1FaceRoutes);
app.use('/api/v1/attendance',  v1AttendanceRoutes);
app.use('/api/v1/shifts',      v1ShiftsRoutes);
app.use('/api/v1/policies',    v1PoliciesRoutes);
app.use('/api/v1/geofences',   v1GeofenceRoutes);
app.use('/api/v1/devices',     v1DevicesRoutes);
app.use('/api/v1/exceptions',  v1ExceptionsRoutes);
app.use('/api/v1/reports',     v1ReportsRoutes);


// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  Face Attendance API  →  http://localhost:${PORT}`);
  console.log(`📖  Swagger UI           →  http://localhost:${PORT}/api-docs\n`);
  console.log('v1 API endpoints:');
  console.log('  POST  /api/v1/auth/login');
  console.log('  POST  /api/v1/auth/refresh');
  console.log('  POST  /api/v1/auth/logout');
  console.log('  POST  /api/v1/auth/request-otp');
  console.log('  POST  /api/v1/auth/verify-otp');
  console.log('  ---');
  console.log('  GET   /api/v1/employees');
  console.log('  PATCH /api/v1/employees/:id/status');
  console.log('  ---');
  console.log('  POST  /api/v1/face/enrollment/start');
  console.log('  POST  /api/v1/face/enrollment/sample');
  console.log('  POST  /api/v1/face/enrollment/complete');
  console.log('  POST  /api/v1/face/enrollment/:template_id/approve');
  console.log('  POST  /api/v1/face/enrollment/:employee_id/reset');
  console.log('  POST  /api/v1/face/verify');
  console.log('  ---');
  console.log('  POST  /api/v1/attendance/check-in');
  console.log('  POST  /api/v1/attendance/check-out');
  console.log('  GET   /api/v1/attendance/my');
  console.log('  POST  /api/v1/attendance/sync');
  console.log('  ---');
  console.log('  GET   /api/v1/shifts   POST /api/v1/shifts/assign');
  console.log('  GET   /api/v1/policies/attendance');
  console.log('  GET   /api/v1/geofences   POST /api/v1/geofences/validate');
  console.log('  POST  /api/v1/devices/register   POST /api/v1/devices/rebind');
  console.log('  POST  /api/v1/exceptions   POST /api/v1/exceptions/:id/review');
  console.log('  GET   /api/v1/reports/daily-summary');
  console.log('  GET   /api/v1/reports/late-arrivals');
  console.log('  GET   /api/v1/reports/monthly-export\n');
});

module.exports = app;

