# Face Attendance System Workflow

This document outlines the core operational workflows of the Academic Face Attendance System, detailing the interaction between the mobile client (Flutter) and the backend (Node.js/PostgreSQL).

## 1. Biometric Enrollment Workflow
The enrollment process establishes the student's or teacher's facial identity within the system using 128-dimensional embedding vectors stored in `pgvector`.

```mermaid
sequenceDiagram
    participant U as Student/Teacher
    participant APP as Mobile App
    participant API as Node.js Backend
    participant DB as PostgreSQL (pgvector)

    U->>APP: Login (Username/Password)
    APP->>API: POST /api/v1/auth/login
    API-->>APP: JWT + User Profile Data
    
    U->>APP: Start Enrollment
    APP->>API: POST /api/v1/face/enrollment/start
    API->>DB: Create Session (IN_PROGRESS)
    API-->>APP: session_id + required_samples (5)

    loop Every Instruction
        APP->>APP: Local Liveness Check
        U->>APP: Performs Action
        APP->>API: POST /api/v1/face/enrollment/sample (Image)
        API->>DB: Save Sample
    end

    APP->>API: POST /api/v1/face/enrollment/complete
    API->>API: Extract Features -> Generate Embedding
    API->>DB: Store VECTOR(128) in face_embedding
    API->>DB: Update Session (COMPLETED)
    
    API-->>APP: Enrollment Success
    APP->>U: Show Success Message
```

---

## 2. Attendance Verification Workflow
The daily attendance process verifies the user's live face against the stored vector using cosine similarity.

```mermaid
sequenceDiagram
    participant U as Student/Teacher
    participant APP as Mobile App
    participant API as Node.js Backend
    participant DB as PostgreSQL (pgvector)

    U->>APP: Open Attendance Screen
    APP->>APP: Detect Face + Liveness
    
    APP->>APP: Face Ready
    APP->>APP: Capture Image
    
    APP->>API: POST /api/v1/face/verify (Image + GPS)
    API->>DB: Fetch Vector for User
    Note over API: vector <=> stored_vector (Cosine Distance)
    API-->>APP: 200 OK + Verification Token
    
    APP->>API: POST /api/v1/attendance/mark (Token + Metadata)
    API->>DB: Insert student_attendance / teacher_attendance
    
    API-->>APP: Attendance Recorded
    APP->>U: Success Message
```

---

## 3. Role-Based Access Control (RBAC)

| Role | Access Level |
| :--- | :--- |
| **Directorate Admin** | System-wide view, reports, and global settings. |
| **Principal** | Institution-level management, faculty approval, and reports. |
| **Teacher** | Mark/verify student attendance, view classroom reports. |
| **Student** | View own attendance and enrollment status. |
