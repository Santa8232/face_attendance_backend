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

// ── Routes (legacy) ───────────────────────────────────────────────────────────
const authRoutes       = require('./routes/authRoutes');
const employeeRoutes   = require('./routes/employeeRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const adminRoutes      = require('./routes/adminRoutes');
const deviceRoutes     = require('./routes/deviceRoutes');

// ── Routes (v1 spec-compliant) ────────────────────────────────────────────────
const v1AuthRoutes       = require('./routes/authRoutes');
const v1EmployeeRoutes   = require('./routes/employeeRoutes');
const v1FaceRoutes       = require('./routes/faceRoutes');
const v1AttendanceRoutes = require('./routes/attendanceRoutes');
const v1ShiftsRoutes     = require('./routes/shiftsRoutes');
const v1PoliciesRoutes   = require('./routes/policiesRoutes');
const v1GeofenceRoutes   = require('./routes/geofenceRoutes');
const v1DevicesRoutes    = require('./routes/devicesRoutes');
const v1ExceptionsRoutes = require('./routes/exceptionsRoutes');
const v1ReportsRoutes    = require('./routes/reportsRoutes');
const loggerMiddleware   = require('./middlewares/loggerMiddleware');

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

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/employees',  employeeRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/devices',    deviceRoutes);

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
  const baseUrl = process.env.API_URL;
  console.log(`🚀  Face Attendance API  →  ${baseUrl}`);
  console.log(`📖  Swagger UI           →  ${baseUrl}/api-docs`);
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
  console.log('  POST  /api/v1/face/enrollment/upload/embeded');
  console.log('  POST  /api/v1/face/enrollment/complete');
  console.log('  POST  /api/v1/face/enrollment/:id/approve');
  console.log('  POST  /api/v1/face/enrollment/:employee_id/reset');
  console.log('  POST  /api/v1/face/verify');
  console.log('  ---');
  console.log('  POST  /api/v1/attendance/check-in');
  console.log('  POST  /api/v1/attendance/check-out');
  console.log('  GET   /api/v1/attendance/my');
  console.log('  POST  /api/v1/attendance/sync');
  console.log('  ---');
  console.log('  GET   /api/v1/shifts');
  console.log('  POST  /api/v1/shifts/assign');
  console.log('  GET   /api/v1/policies/attendance/:officeId');
  console.log('  GET   /api/v1/geofences');
  console.log('  POST  /api/v1/geofences/validate');
  console.log('  ---');
  console.log('  GET   /api/v1/exceptions');
  console.log('  POST  /api/v1/exceptions');
  console.log('  GET   /api/v1/reports/daily-summary\n');
});

module.exports = app;

