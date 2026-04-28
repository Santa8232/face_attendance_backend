# Academic Face Attendance API — Full Documentation

> **Base URL:** `http://localhost:3000` or `http://<YOUR_IP>:3000` (for mobile devices)
> **v1 Prefix:** All spec-compliant endpoints are under `/api/v1/`
> **Database:** PostgreSQL 17 + `pgvector`
> **Swagger UI:** `http://localhost:3000/api-docs`
> **Auth:** Protected endpoints require `Authorization: Bearer <access_token>`
> **Content-Type:** `application/json` unless marked `multipart/form-data`

---

## Response Envelope

Every endpoint returns the same shape:

```json
{
  "success": true,
  "message": "Human readable message",
  "data":    { } | [ ]
}
```

---

## A — Authentication

### `POST /api/v1/auth/login`
Login with username or email. Returns dual tokens.

**Request:**
```json
{
  "username":    "alex_johnson",
  "password":    "user_password",
  "device_id":   "a1b2c3d4e5",
  "device_name": "iPhone 15",
  "device_model": "iPhone 15 Pro",
  "os_version": "17.4",
  "app_version": "1.0.0"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "access_token":  "eyJhbGci... (8h)",
    "refresh_token": "eyJhbGci... (7d)",
    "user": {
      "id": 123,
      "username": "alex_johnson",
      "full_name": "Alex Johnson",
      "role": "Student",
      "institution_id": 1
    }
  }
}
```

---

## B — Students & Teachers

### `GET /api/v1/students/me`
🔒 **Authenticated** — returns the logged-in student's profile.

### `GET /api/v1/teachers/me`
🔒 **Authenticated** — returns the logged-in teacher's profile.

### `GET /api/v1/students`
🔒 **Teacher / Principal** — list students in a specific class or institution.

---

## C — Face Enrollment

### `POST /api/v1/face/enrollment/start`
🔒 **Authenticated** — initialize a session to capture face samples.

**Response `201`:**
```json
{
  "data": {
    "session_id": 456,
    "required_samples": 5
  }
}
```

### `POST /api/v1/face/enrollment/sample`
🔒 **Authenticated** — upload a face sample (image).

### `POST /api/v1/face/enrollment/complete`
🔒 **Authenticated** — finalize enrollment and generate the 128-dim vector.

---

## D — Face Verification

### `POST /api/v1/face/verify`
🔒 **Authenticated** — verify a live face against the stored template using `pgvector` cosine similarity.

---

## E — Attendance

### `POST /api/v1/attendance/mark`
🔒 **Authenticated** — record student or teacher attendance with location and verification token.

---

*Last updated: 2026-04-28 | Academic System — Integrated with pgvector*
