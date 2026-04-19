-- Face Attendance System Database Schema (PostgreSQL)

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'EMPLOYEE', -- 'ADMIN', 'HR', 'EMPLOYEE'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Offices
CREATE TABLE IF NOT EXISTS offices (
    office_id UUID PRIMARY KEY,
    office_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Departments
CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY,
    office_id UUID REFERENCES offices(office_id),
    department_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Shifts
CREATE TABLE IF NOT EXISTS shifts (
    shift_id UUID PRIMARY KEY,
    office_id UUID REFERENCES offices(office_id),
    shift_name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Employees
CREATE TABLE IF NOT EXISTS employees (
    employee_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    office_id UUID REFERENCES offices(office_id),
    department_id UUID REFERENCES departments(department_id),
    shift_id UUID REFERENCES shifts(shift_id),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    designation VARCHAR(100),
    employment_type VARCHAR(50), -- 'FULL_TIME', 'PART_TIME', etc.
    is_active BOOLEAN DEFAULT TRUE,
    face_enrolled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Enrollment Sessions
CREATE TABLE IF NOT EXISTS enrollment_sessions (
    enrollment_session_id VARCHAR(100) PRIMARY KEY,
    employee_id UUID REFERENCES employees(employee_id),
    device_id VARCHAR(255),
    initiated_by UUID REFERENCES users(user_id),
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    sample_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 7. Enrollment Samples
CREATE TABLE IF NOT EXISTS enrollment_samples (
    sample_id UUID PRIMARY KEY,
    enrollment_session_id VARCHAR(100) REFERENCES enrollment_sessions(enrollment_session_id),
    sample_no INTEGER NOT NULL,
    image_url TEXT,
    image_base64 TEXT, -- Use sparingly, prefer URLs
    quality_score DECIMAL(5, 4),
    liveness_score DECIMAL(5, 4),
    yaw DECIMAL(10, 4),
    pitch DECIMAL(10, 4),
    roll DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Face Templates (Approved templates)
CREATE TABLE IF NOT EXISTS face_templates (
    template_id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(employee_id),
    enrollment_session_id VARCHAR(100) REFERENCES enrollment_sessions(enrollment_session_id),
    aggregate_embedding JSONB, -- Store embeddings as JSONB
    reference_image_url TEXT,
    sample_count INTEGER,
    quality_avg DECIMAL(5, 4),
    liveness_avg DECIMAL(5, 4),
    is_active BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Attendance Logs
CREATE TABLE IF NOT EXISTS attendance_logs (
    attendance_id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(employee_id),
    office_id UUID REFERENCES offices(office_id),
    shift_id UUID REFERENCES shifts(shift_id),
    event_type VARCHAR(50) NOT NULL, -- 'CHECK_IN', 'CHECK_OUT'
    attendance_date DATE NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_accuracy_m DECIMAL(10, 2),
    geofence_status VARCHAR(50), -- 'INSIDE', 'OUTSIDE', 'SKIPPED'
    face_match_score DECIMAL(5, 4),
    liveness_score DECIMAL(5, 4),
    verification_status VARCHAR(50) DEFAULT 'APPROVED',
    device_id VARCHAR(255),
    network_mode VARCHAR(50), -- 'ONLINE', 'OFFLINE'
    offline_flag BOOLEAN DEFAULT FALSE,
    selfie_image_url TEXT,
    shift_status VARCHAR(50), -- 'on_time', 'late', etc.
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Attendance Daily Summary
CREATE TABLE IF NOT EXISTS attendance_daily_summary (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(employee_id),
    attendance_date DATE NOT NULL,
    first_check_in TIMESTAMP WITH TIME ZONE,
    last_check_out TIMESTAMP WITH TIME ZONE,
    total_work_minutes INTEGER DEFAULT 0,
    day_status VARCHAR(50) DEFAULT 'PRESENT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);

-- 11. Geofences
CREATE TABLE IF NOT EXISTS geofences (
    geofence_id UUID PRIMARY KEY,
    office_id UUID REFERENCES offices(office_id),
    geofence_name VARCHAR(255),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_m INTEGER DEFAULT 200,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Attendance Policies
CREATE TABLE IF NOT EXISTS attendance_policies (
    policy_id UUID PRIMARY KEY,
    office_id UUID REFERENCES offices(office_id) UNIQUE,
    require_face_match BOOLEAN DEFAULT TRUE,
    require_liveness BOOLEAN DEFAULT TRUE,
    require_geofence BOOLEAN DEFAULT TRUE,
    allow_offline BOOLEAN DEFAULT TRUE,
    max_offline_hours INTEGER DEFAULT 24,
    allow_field_mode BOOLEAN DEFAULT FALSE,
    max_daily_attempts INTEGER DEFAULT 10,
    duplicate_window_sec INTEGER DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Attendance Exceptions
CREATE TABLE IF NOT EXISTS attendance_exceptions (
    exception_id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(employee_id),
    exception_type VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    review_remarks TEXT,
    reviewed_by UUID REFERENCES users(user_id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Device Registry
CREATE TABLE IF NOT EXISTS device_registry (
    device_registry_id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(employee_id),
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_model VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    push_token TEXT,
    is_trusted BOOLEAN DEFAULT TRUE,
    trust_score DECIMAL(3, 2) DEFAULT 1.0,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, device_id)
);

-- 15. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id UUID PRIMARY KEY,
    actor_user_id UUID, -- Not enforced FK because it might be system or deleted user
    actor_role VARCHAR(50),
    action_type VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100),
    entity_id VARCHAR(100),
    old_value_json JSONB,
    new_value_json JSONB,
    ip_address VARCHAR(45),
    device_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX idx_attendance_date ON attendance_logs(attendance_date);
CREATE INDEX idx_attendance_employee ON attendance_logs(employee_id);
CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
