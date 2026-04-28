# Academic Face Attendance Backend 🎓

A **Node.js / Express REST API** for an Academic Attendance System — powered by **PostgreSQL** and **Face Recognition**.

This backend manages institutions, departments, students, and teachers, using **`pgvector`** for high-performance biometric similarity searches.

---

## Key Features 🚀

- **Academic Structure** — Manage Institutions, Departments, Courses, Semesters, and Classes.
- **Role-Based Access** — Support for Directorate Admin, Principal, Teacher, and Student.
- **Biometric Enrollment** — Store face embeddings using `pgvector` for instant matching.
- **Smart Attendance** — Track attendance for both students and teachers with location (GPS) and face verification.
- **Device Security** — Bind student/teacher logins to specific devices for integrity.
- **Academic Calendar** — Track holidays and events at the institution level.
- **Leave Management** — Apply for and approve leaves (Casual, Sick, etc.).
- **Swagger Documentation** — Explore APIs interactively at `/api-docs`.

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
```

### 3. Initialize Database & Migration
```bash
# 1. Reset and initialize schema
node src/db/suggested/initDb_suggested.js --reset

# 2. Migrate sample data (from data/*.json)
node src/db/suggested/migrateData_suggested.js
```

### 4. Run Application
```bash
# Start in development mode
npm run dev
```
Server starts at **`http://localhost:3000`**  
Swagger UI at **`http://localhost:3000/api-docs`**

---

## Project Structure 📂

```
face_attendance_backend/
├── src/
│   ├── controllers/      # Business logic (Auth, Attendance, etc.)
│   ├── db/
│   │   ├── suggested/    # New PostgreSQL schema & migration scripts
│   │   └── db.js         # Connection pool
│   ├── routes/           # API endpoints
│   ├── utils/            # Shared helpers
│   └── server.js         # Entry point
├── data/                 # Sample JSON data for migration
├── docs/                 # Documentation
├── pgvector-extracted/   # Pre-compiled pgvector files for Windows
├── CHANGELOG.md          # History of project updates
├── DB_INITIALIZATION.md  # Detailed DB setup guide
└── README.md
```

---

## Tech Stack 🛠️

- **Runtime**: Node.js
- **Database**: PostgreSQL 17 + `pgvector`
- **Authentication**: JWT & Bcrypt
- **Documentation**: Swagger / OpenAPI
- **Validation**: Joi (optional)
- **Face Recognition**: Integration ready for embedding vectors (128-dim)

---

## Maintenance 🧹

- **Clear all table data**: `node src/db/suggested/clean_tables_data.js`
- **Format code**: `npm run format` (if configured)
