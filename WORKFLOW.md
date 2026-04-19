# Face Attendance System Workflow

This document outlines the core operational workflows of the Face Attendance System, detailing the interaction between the Flutter mobile client and the Node.js/PostgreSQL backend.

## 1. Biometric Enrollment Workflow
The enrollment process establishes the user's facial identity within the system.

```mermaid
sequenceDiagram
    participant U as Employee
    participant APP as Flutter App
    participant API as Node.js Backend
    participant DB as PostgreSQL

    U->>APP: Login (Email/Password)
    APP->>API: POST /auth/login
    API-->>APP: JWT + Employee Data
    
    U->>APP: Start Enrollment
    APP->>API: POST /face/enrollment/start
    API->>DB: Create Session (IN_PROGRESS)
    API-->>APP: session_id + required_samples (5)

    loop Every Instruction (Look Straight, Turn Left, etc.)
        APP->>APP: Local Liveness Check (ML Kit)
        U->>APP: Performs Action
        APP->>API: POST /face/enrollment/sample (Multipart)
        API->>DB: Save Sample + Increment Count
    end

    APP->>API: POST /face/enrollment/complete
    API->>DB: Aggregate Samples -> Generate Template
    API->>DB: Update Session (COMPLETED)
    
    Note over API,DB: Dev Mode: Auto-Approval Enabled
    API->>DB: Set is_active = TRUE
    API->>DB: Set face_enrolled = TRUE
    
    API-->>APP: Enrollment Success
    APP->>U: Show Success Message
```

---

## 2. Attendance Verification Workflow
The check-in/out process verifies the user's identity against the enrolled template.

```mermaid
sequenceDiagram
    participant U as Employee
    participant APP as Flutter App
    participant API as Node.js Backend
    participant DB as PostgreSQL

    U->>APP: Tap Check-in / Check-out
    APP->>APP: Start Camera Stream
    
    loop Real-time Detection
        APP->>APP: Detect Face + Liveness (ML Kit)
    end
    
    APP->>APP: Face Ready (Liveness Passed)
    APP->>APP: Take Snapshot (High-Res)
    
    APP->>API: POST /face/verify (Image + Telemetry)
    API->>DB: Fetch Active Template
    Note over API: Compare Face (Phase I: Local Match Check)
    API-->>APP: 200 OK + verification_token

    APP->>API: POST /attendance/check-in (Token + Location)
    API->>API: Consume verification_token
    API->>DB: Insert attendance_logs
    API->>DB: Update Daily Summary
    
    API-->>APP: Attendance Recorded Successfully
    APP->>U: Visual Success / Snack bar
```

---

## 3. Error Recovery Logic
How the system handles common failures.

| Scenario | System Behavior | Recovery Action |
| :--- | :--- | :--- |
| **No Session ID** | Scanner blocked | Error shown with **Retry Initialization** button |
| **Verification Failed** | Scanner paused | Error shown with **Retry Scan** button |
| **Not Enrolled** | API returns 400 | User prompted to go to Enrollment screen |
| **Network Loss** | Offline detection | (Phase II) Cache logs for background sync |
