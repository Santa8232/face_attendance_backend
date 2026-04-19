# Face Attendance API — Full Documentation

> **Base URL:** `http://localhost:3000` or `http://<YOUR_IP>:3000` (for mobile devices)
> **v1 Prefix:** All spec-compliant endpoints are under `/api/v1/`
> **Database:** PostgreSQL (Asynchronous Store)
> **Swagger UI:** `http://localhost:3000/api-docs`
> **Auth:** Protected endpoints require `Authorization: Bearer <access_token>`
> **Content-Type:** `application/json` unless marked `multipart/form-data`

---

## Table of Contents

1. [Response Envelope](#response-envelope)
2. [A — Authentication](#a--authentication)
3. [B — Employees](#b--employees)
4. [C — Face Enrollment](#c--face-enrollment)
5. [D — Face Verification](#d--face-verification)
6. [E — Attendance](#e--attendance)
7. [F — Shifts & Policies](#f--shifts--policies)
8. [G — Geofences](#g--geofences)
9. [H — Device Trust](#h--device-trust)
10. [I — Exceptions](#i--exceptions)
11. [J — Reports](#j--reports)
12. [Validation Rules](#validation-rules)
13. [Error Codes](#error-codes)

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
Login with employee code or email. Returns dual tokens.

**Request:**
```json
{
  "username":    "EMP00123",
  "password":    "user_password",
  "device_id":   "a1b2c3d4e5",
  "device_name": "iPhone 15"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "access_token":  "eyJhbGci... (8h)",
    "refresh_token": "eyJhbGci... (7d)",
    "employee": {
      "employee_id":   123,
      "employee_code": "EMP00123",
      "name":          "John Singh",
      "role":          "employee",
      "office_id":     4
    }
  }
}
```

> `username` accepts either **email address** or **employee_code**.

---

### `POST /api/v1/auth/refresh`
Exchange a valid refresh token for a new access token.

**Request:**
```json
{ "refresh_token": "eyJhbGci..." }
```

**Response `200`:** `{ "access_token": "eyJhbGci..." }`

---

### `POST /api/v1/auth/logout`
🔒 **Authenticated** — revoke the refresh token (server-side denylist).

**Request:** `{ "refresh_token": "eyJhbGci..." }`

---

### `POST /api/v1/auth/request-otp`
Request a 6-digit OTP sent to the employee's registered contact.

**Request:**
```json
{ "employee_code": "EMP00123" }
```

> In development the OTP is also returned in `_dev_otp` for convenience.

---

### `POST /api/v1/auth/verify-otp`
Verify OTP and receive tokens (same shape as login).

**Request:**
```json
{
  "employee_code": "EMP00123",
  "otp":           "847291",
  "device_id":     "a1b2c3d4e5"
}
```

---

## B — Employees

### `GET /api/v1/employees`
🔒 **ADMIN / HR**

| Query Param | Description |
|---|---|
| `office_id` | Filter by office |
| `department_id` | Filter by department |
| `status` | `active` or `inactive` |

**Response `200`:** Array of employee objects.

---

### `GET /api/v1/employees/me`
🔒 **Any** — returns the logged-in user's own employee profile.

---

### `GET /api/v1/employees/:employee_id`
🔒 **ADMIN / HR**

---

### `POST /api/v1/employees`
🔒 **ADMIN**

**Request:**
```json
{
  "full_name":       "Jane Smith",
  "email":           "jane@company.com",
  "office_id":       "uuid",
  "department_id":   "uuid",
  "shift_id":        "uuid",
  "employee_code":   "EMP002",
  "phone":           "9876543210",
  "designation":     "Designer",
  "employment_type": "FULL_TIME"
}
```

---

### `PUT /api/v1/employees/:employee_id`
🔒 **ADMIN / HR** — partial update, send only fields to change.

---

### `PATCH /api/v1/employees/:employee_id/status`
🔒 **ADMIN** — activate or deactivate an employee.

**Request:** `{ "status": "inactive" }`
**Response:** `{ "employee_id": "uuid", "status": "inactive" }`

---

## C — Face Enrollment

Enrollment is a 3-step flow:

```
POST /start  →  POST /sample (×1–5)  →  POST /complete  →  POST /:template_id/approve
```

### `POST /api/v1/face/enrollment/start`
🔒 **Authenticated**

**Request:**
```json
{
  "employee_id": 123,
  "device_id":   "a1b2c3d4e5"
}
```

**Response `201`:**
```json
{
  "data": {
    "enrollment_session_id": "enr_20260418_001",
    "required_samples": 5,
    "instructions": [
      "Look straight at the camera",
      "Turn your head slightly to the left",
      "Turn your head slightly to the right",
      "Blink naturally when prompted",
      "Keep your face well-lit and unobstructed"
    ]
  }
}
```

---

### `POST /api/v1/face/enrollment/sample`
🔒 **Authenticated** — accepts `image_base64` (JSON) or `image` file (multipart).

**Request (JSON):**
```json
{
  "session_id":     "enr_20260418_001",
  "sample_no":      1,
  "image_base64":   "...base64...",
  "quality_score":  0.93,
  "liveness_score": 0.88,
  "pose": { "yaw": 3.2, "pitch": 1.1, "roll": 0.4 }
}
```

> **Note:** Accepts `session_id` or `enrollment_session_id`.

**Response `200`:**
```json
{
  "data": {
    "enrollment_session_id": "enr_20260418_001",
    "sample_no":      1,
    "samples_received": 1,
    "samples_required": 5,
    "complete": false
  }
}
```

---

### `POST /api/v1/face/enrollment/complete`
🔒 **Authenticated**

**Request:** `{ "session_id": "enr_20260418_001" }`

> **Note:** Accepts `session_id` or `enrollment_session_id`.

**Response `200`:**
```json
{
  "data": {
    "template_id": 456,
    "status": "pending_approval"
  }
}
```

---

### `POST /api/v1/face/enrollment/:template_id/approve`
🔒 **ADMIN / HR** — activate the face template for attendance use.

**Response `200`:** `{ "template_id": "uuid", "status": "approved" }`

---

### `POST /api/v1/face/enrollment/:employee_id/reset`
🔒 **ADMIN** — deactivate all templates, set `face_enrolled = false`. Audit logged.

---

### `GET /api/v1/face/enrollment/:employee_id/status`
🔒 **Authenticated**

---

## D — Face Verification

### `POST /api/v1/face/verify`
🔒 **Authenticated** — validate face on device; returns a single-use `verification_token` consumed by check-in/check-out.

**Request:**
```json
{
  "employee_id": 123,
  "device_id":   "a1b2c3d4e5",
  "image_base64": "...base64...",
  "capture_meta": {
    "yaw": 1.0, "pitch": 0.5, "roll": 0.0,
    "blur_score": 0.11, "brightness": 0.76
  },
  "liveness_meta": {
    "liveness_score":  0.91
  }
}
```

> **Note:** `employee_id` is optional; if missing, it's inferred from the authenticated user's session.

**Response `200`:**
```json
{
  "data": {
    "matched":             true,
    "confidence":          0.94,
    "template_id":         456,
    "risk_flags":          [],
    "verification_token":  "fvt_abc123...",
    "token_expires_in":    "5 minutes"
  }
}
```

---

## E — Attendance

### `POST /api/v1/attendance/check-in`
### `POST /api/v1/attendance/check-out`
🔒 **Authenticated**

**Request:**
```json
{
  "employee_id":        123,
  "device_id":          "a1b2c3d4e5",
  "verification_token": "fvt_abc123...",
  "timestamp":          "2026-04-18T09:08:22+05:30",
  "location": {
    "latitude":   24.8170,
    "longitude":  93.9368,
    "accuracy_m": 12.4
  },
  "network_mode":     "online",
  "remarks":          "Office attendance"
}
```

> **Note:** `employee_id` is optional; if missing, it's inferred from the authenticated user's session.

**Response `200`:**
```json
{
  "data": {
    "attendance_id": 98765,
    "status":        "present",
    "marked_at":     "2026-04-18T09:08:24+05:30",
    "shift_status":  "on_time",
    "geofence":      "INSIDE"
  }
}
```

---

### `GET /api/v1/attendance/my`
🔒 **Authenticated** — own attendance history.

---

### `POST /api/v1/attendance/sync`
🔒 **Authenticated** — batch upload events captured offline.

**Request:**
```json
{
  "device_id": "a1b2c3d4e5",
  "events": [
    {
      "offline_event_id": "off_001",
      "employee_id":      123,
      "event_type":       "check_in",
      "timestamp":        "2026-04-18T09:08:22+05:30",
      "location": { "latitude": 24.817, "longitude": 93.937, "accuracy_m": 12.4 },
      "verification_payload": { "confidence": 0.94, "liveness_score": 0.91 }
    }
  ]
}
```

---

## F — Shifts & Policies

### `GET /api/v1/shifts?office_id=4`
🔒 **ADMIN / HR**

### `POST /api/v1/shifts/assign`
🔒 **ADMIN / HR**

---

### `GET /api/v1/policies/attendance?office_id=4`
🔒 **Authenticated**

---

## G — Geofences

### `POST /api/v1/geofences/validate`
🔒 **Authenticated** — check if a GPS point is inside an office geofence.

---

## H — Device Trust

### `POST /api/v1/devices/register`
🔒 **Authenticated**

### `POST /api/v1/devices/rebind`
🔒 **Authenticated** — transfer device trust.

---

## I — Exceptions

### `POST /api/v1/exceptions`
🔒 **Authenticated** — employee raises an attendance exception.

**Allowed `exception_type` values:** `face_mismatch` · `poor_network` · `geofence_failure` · `damaged_camera` · `emergency_field_duty` · `device_stolen` · `manual_correction` · `other`

---

## J — Reports

### `GET /api/v1/reports/daily-summary`
### `GET /api/v1/reports/late-arrivals`
### `GET /api/v1/reports/monthly-export`

---

## Static File Access

Uploaded images are served at:
```
GET /uploads/enrollment/<filename>
GET /uploads/attendance/<filename>
```

---

*Last updated: 2026-04-19 | Phase I — Optimized for Mobile Integration*
