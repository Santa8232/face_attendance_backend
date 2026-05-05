# Face Attendance API Documentation 📖

This document outlines the API endpoints for the Face Attendance System (Dart/Shelf Implementation).

**Base URL**: `http://localhost:3000`
**Content-Type**: `application/json`

---

## 🔐 Authentication

### POST `/api/v1/auth/login`
Authenticate a user and receive access/refresh tokens.
- **Body**:
  ```json
  {
    "username": "employee_code_or_email",
    "password": "your_password",
    "device_id": "optional_id",
    "device_name": "optional_name"
  }
  ```
- **Response** (200):
  ```json
  {
    "success": true,
    "access_token": "JWT_TOKEN",
    "refresh_token": "REFRESH_TOKEN",
    "user": { ... }
  }
  ```

### POST `/api/v1/auth/refresh`
Get a new access token using a refresh token.
- **Body**: `{ "refresh_token": "..." }`

### POST `/api/v1/auth/logout`
Invalidate current session.
- **Headers**: `Authorization: Bearer <token>`

---

## 👥 Employees

### GET `/api/v1/employees`
Fetch a list of all active employees.
- **Headers**: `Authorization: Bearer <token>`

### PATCH `/api/v1/employees/:id/status`
Update employee status (active/inactive).

---

## 👤 Face Management

### POST `/api/v1/face/enrollment/start`
Begin the face enrollment process for an employee.

### POST `/api/v1/face/enrollment/upload/embeded`
Upload face embeddings (128-dimensional vector).
- **Body**:
  ```json
  {
    "user_id": 1,
    "embedding_vector": [0.12, -0.05, ...]
  }
  ```

### POST `/api/v1/face/verify`
Verify an employee's face for attendance.
- **Body**:
  ```json
  {
    "employee_id": 1,
    "face_embedding": [...]
  }
  ```
- **Response**: Returns `matched: true/false` and similarity confidence.

---

## 📅 Attendance

### POST `/api/v1/attendance/check-in`
Mark attendance check-in.
- **Body**:
  ```json
  {
    "employee_id": 1,
    "latitude": 24.817,
    "longitude": 93.936,
    "verification_token": "..."
  }
  ```

### POST `/api/v1/attendance/check-out`
Mark attendance check-out.

---

## 📍 Geofences & Policies

### GET `/api/v1/geofences`
Retrieve active geofences for the institution.

### GET `/api/v1/policies/attendance/:officeId`
Fetch attendance policies (grace time, late marks, etc.).

---

## 🛠 System

### GET `/health`
Check API health and database connectivity.
- **Response**:
  ```json
  {
    "status": "ok",
    "service": "Face Attendance API (Dart)",
    "time": "2026-05-05T..."
  }
  ```

---
*Note: This documentation is a work in progress as more routes are ported to the Dart backend.*
