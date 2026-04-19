# Face Attendance Backend

A **Node.js / Express REST API** for the Mobile Face Attendance System — built from the product requirements document.  
Data is stored in a persistent **PostgreSQL** database. The architecture utilizes an asynchronous `src/db/store.js` adapter layer, ensuring production-grade performance and reliability while maintaining a clean separation between business logic and the persistence layer.

---

## Summary

This backend powers a **biometric face-attendance platform** for enterprises and institutions. It handles the full lifecycle from employee onboarding to daily attendance reporting:- **Authentication** — JWT-based login with role-based access control (Admin · HR · Employee). Now includes integer `id` and `employee_id` in token payloads.
- **Employee Management** — CRUD with soft-delete, department, shift and office linking. Uses auto-incrementing integer primary keys.
- **Face Enrollment** — multi-sample session flow (up to 5 samples), face template storage, admin reset with audit trail.
- **Attendance Engine** — check-in / check-out with a full server-side validation pipeline:
  - Face match score threshold (≥ 0.75 cosine similarity)
  - Liveness check confirmation
  - GPS geofence validation (Haversine formula)
  - Duplicate-punch prevention (120-second window)
- **Offline Sync** — batch upload of attendance captured without connectivity, with configurable offline window (default 12 h).
- **Admin Dashboard Data** — today's summary, daily work-hour summaries, exception management, audit log.
- **Device Registry** — bind and trust employee devices; untrust on loss/theft. Supports device rebinding for employees.
- **Swagger UI** — interactive API explorer at `/api-docs`.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
# Create a .env file with your DB credentials
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=your_password
# DB_NAME=facial

# 3. Initialize Database (SERIAL IDs)
node src/db/initDb.js --reset

# 4. Migrate Data (optional - maps JSON UUIDs to Integer IDs)
node src/db/migrateData.js

# 5. Start with auto-reload
npm run dev
```

Server starts at **`http://localhost:3000`**  
Swagger UI at **`http://localhost:3000/api-docs`**

---

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-reload on file save) |
| `npm start` | Start without auto-reload |
| `node src/db/initDb.js` | Initialize PostgreSQL schema |
| `node src/db/migrateData.js` | Migrate legacy JSON data to PostgreSQL |

---

## Seeded Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@company.com` | `Admin@1234` |
| Employee | `emp01@company.com` | `Emp@1234` |

---

## API Overview (v1)

Full reference → [`docs/api_doc.md`](./docs/api_doc.md)  
Interactive explorer → `http://localhost:3000/api-docs`

| Group | Key Endpoints |
|-------|--------------|
| **Auth** | `POST /api/v1/auth/login` · `/refresh` · `/logout` |
| **Employees** | `GET /api/v1/employees` · `PATCH /api/v1/employees/:id/status` |
| **Enrollment** | `POST /api/v1/face/enrollment/start` · `/sample` · `/complete` |
| **Attendance** | `POST /api/v1/attendance/check-in` · `/check-out` · `/sync` |
| **Reports** | `GET /api/v1/reports/daily-summary` · `/late-arrivals` |
| **Management** | `GET /api/v1/shifts` · `POST /api/v1/shifts/assign` · `/api/v1/geofences/validate` |
| **Devices** | `POST /api/v1/devices/register` · `/api/v1/devices/rebind` |

---

## Project Structure

```
face_attendance_backend/
├── src/
│   ├── config/
│   │   ├── constants.js          # Thresholds, JWT config, limits
│   │   └── swagger.js            # OpenAPI 3.0 spec
│   ├── controllers/
│   │   ├── adminController.js    # Master data + exceptions + audit
│   │   ├── attendanceController.js # Check-in/out, sync, summaries
│   │   ├── authController.js     # Login, refresh, logout
│   │   ├── deviceController.js   # Device registry & rebinding
│   │   ├── employeeController.js # Employee management
│   │   ├── enrollmentController.js # Face enrollment flow
│   │   ├── faceVerificationController.js # Face matching logic
│   │   └── reportsController.js  # Consolidated reporting
│   ├── db/
│   │   ├── store.js              # PostgreSQL async adapter (ID-aware)
│   │   ├── initDb.js             # Schema initialization (SERIAL IDs)
│   │   └── migrateData.js        # JSON-to-Postgres migration engine
│   ├── middleware/
│   │   ├── auth.js               # JWT authenticate() + authorize()
│   │   └── upload.js             # Multer image upload
│   ├── routes/
│   │   ├── v1/                   # Versioned routes (consolidated)
│   │   └── ...                   # Root level routes
│   ├── utils/helpers.js          # asyncHandler, ok(), fail(), haversine
│   └── server.js                 # Express app entry point
├── uploads/                      # Uploaded images (auto-created, gitignored)
├── docs/
│   └── api_doc.md                # Full API documentation
├── package.json
├── changelog.md                  # Detailed history of changes
└── README.md
```

---

## Configuration

All tunable values live in `src/config/constants.js`:

| Constant | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | *(hardcoded)* | Change in production via env var |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime |
| `FACE_MATCH_THRESHOLD` | `0.75` | Minimum cosine similarity to approve attendance |
| `MAX_ENROLLMENT_SAMPLES` | `5` | Max face samples per enrollment session |
| `DUPLICATE_WINDOW_SECONDS` | `120` | Block duplicate punch within this window |
| `MAX_OFFLINE_HOURS` | `12` | Reject offline events older than this |
| `MAX_FILE_SIZE_MB` | `5` | Max image upload size |

Set `PORT` and `JWT_SECRET` via environment variables in production:
```bash
PORT=8080 JWT_SECRET=your-secret-here npm start
```

---

## Database Migration (PostgreSQL)

The system has been fully migrated to **PostgreSQL**. Data access is handled through the asynchronous **`src/db/store.js`** adapter, which uses a connection pool for high-concurrency environments.

To initialize the database schema, run:
```bash
node src/db/initDb.js
```

---

## Planned Phases

| Phase | Scope |
|-------|-------|
| **I (current)** | Employee master, login, enrollment, check-in/out, admin dashboard, shifts, geofences |
| **II** | Liveness enhancement, device binding, offline sync hardening, exception workflow, audit dashboard |
| **III** | Payroll/HRMS integration, SSO, branch analytics, policy engine, multilingual UI |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| File upload | Multer |
| API docs | Swagger UI Express + swagger-jsdoc |
| Dev reload | Nodemon |
| Data (Phase I) | PostgreSQL (via `pg` pool) |
| Data (Phase II+) | Scalable RDS / Cloud SQL |
