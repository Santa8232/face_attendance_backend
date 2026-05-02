# Academic Face Attendance Backend 🎓

A **Node.js / Express REST API** for an Academic Attendance System — powered by **PostgreSQL** and **Face Recognition**.

This backend manages institutions, departments, students, and teachers, using **`pgvector`** for high-performance biometric similarity searches.

---

## Key Features 🚀

- **Academic Structure** — Manage Institutions, Departments, Courses, Semesters, and Classes.
- **Role-Based Access** — Support for Directorate Admin, Principal, Teacher, and Student roles.
- **Biometric Enrollment** — Store face embeddings using `pgvector` for instant matching.
- **Smart Attendance** — Track attendance for both students and teachers with location (GPS) and face verification.
- **Device Security** — Bind student/teacher logins to specific devices for integrity.
- **Swagger Documentation** — Explore APIs interactively at `/api-docs`.
- **Flexible Routing** — Supports both `/api/` and `/api/v1/` prefixes.

---

## Quick Start ⚡

### 1. Prerequisites
- **PostgreSQL 17** installed.
- **`pgvector`** extension installed (See [DB_INITIALIZATION.md](./DB_INITIALIZATION.md) for Windows steps).

### 2. Setup
```bash
# Install dependencies
npm install

# Configure .env (Copy from example or create new)
# DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
# API_URL (Used for documentation and startup logging)
```

### 3. Initialize Database & Migration
```bash
# 1. Reset and initialize schema
node src/db/initDb.js --reset

# 3. Seed demo accounts (Admin/Demo Employee)
node src/db/seed.js

# 2. Migrate sample data (from data/*.json)
node src/db/migrateData.js
```

### 4. Run Application
```bash
# Start in development mode
npm run dev
```
Server starts dynamically based on your IP (e.g., **`http://10.10.1.78:3000`**)  
Swagger UI at **`/api-docs`**

---

## Project Structure 📂

```
face_attendance_backend/
├── src/
│   ├── config/           # Configuration (Constants, Swagger)
│   ├── controllers/      # Business logic (Auth, Attendance, etc.)
│   ├── db/               # Database Layer
│   │   ├── db.js         # Connection pool
│   │   ├── store.js      # Unified data access layer (Mapped to Education schema)
│   │   ├── schema.sql    # Core database structure
│   │   └── initDb.js     # Setup scripts
│   ├── middleware/       # JWT Auth & Validation
│   ├── routes/           # API endpoints
│   ├── utils/            # Shared helpers
│   └── server.js         # Entry point
├── data/                 # Sample JSON data for migration
├── docs/                 # Documentation
├── scratch/              # Diagnostic and test scripts
└── README.md
```

---

## Tech Stack 🛠️

- **Runtime**: Node.js
- **Database**: PostgreSQL 17 + `pgvector`
- **Authentication**: JWT & Bcrypt (Supports `password` and `password_hash`)
- **Documentation**: Swagger / OpenAPI 3.0
- **Face Recognition**: Ready for 128-dim or 512-dim embedding vectors

---

## Maintenance 🧹

- **Clear all table data**: `node src/db/clean_tables_data.js`
- **Initialize DB**: `node src/db/initDb.js --reset`
- **Check Tables**: Use diagnostic scripts in `scratch/` to verify schema integrity.
