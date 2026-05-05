# Face Attendance Backend (Dart Shelf)

A high-performance RESTful API for a Mobile Face Attendance System, ported from Node.js to Dart using the **Shelf** framework.

## 🚀 Features
- **Modern Tech Stack**: Built with Dart 3 and the Shelf web framework.
- **Biometric Ready**: Integrated `pgvector` support for storing and comparing face embeddings.
- **Secure**: JWT-based authentication and BCrypt password hashing.
- **Modular Architecture**: Clean separation of routes, models, and database logic.
- **Generic Store**: A flexible database abstraction layer for rapid development.

## 🛠 Prerequisites
- **Dart SDK**: `^3.0.0` or higher.
- **PostgreSQL**: Version 15+ recommended.
- **pgvector Extension**: Must be installed in your PostgreSQL instance for face similarity features.
  - [pgvector Installation Guide](https://github.com/pgvector/pgvector)

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone <repository-url>
cd face_attendance_dart
```

### 2. Install dependencies
```bash
dart pub get
```

### 3. Environment Configuration
Create a `.env` file in the root directory (or copy the example):
```env
PORT=3000
NODE_ENV=development

# JWT Secrets
JWT_SECRET=your_jwt_secret
REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=8h

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=facial
```

### 4. Database Setup
Ensure your PostgreSQL database is running and the `vector` extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Run your schema migrations (use the `schema.sql` from the parent project).

## 🏃 Running the Server

### Development Mode
```bash
dart run bin/server.dart
```

### Production Build
```bash
dart compile exe bin/server.dart -o server
./server
```

## 📂 Project Structure
```text
bin/
├── database/         # Database connection and Store abstraction
├── middleware/       # JWT Auth and Logging middlewares
├── models/           # Data models (UserModel, etc.)
├── routes/           # API route definitions
└── server.dart       # Entry point
lib/
└── utils/            # Utilities (Config, FaceMath, etc.)
```

## 📑 API Endpoints (Current)
- `GET /health`: Server status check.
- `POST /api/auth/login`: Authenticate and receive JWT tokens.
- `POST /api/v1/auth/login`: (Alias for login).

---
Built with ❤️ using Dart & Shelf.
