---------------------------------------------------------
-- 0. Extensions
---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

---------------------------------------------------------
-- 0. Custom Types & Enums
---------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE attendance_mode_enum AS ENUM ('Manual','GeoTagged','AI-Face','AI-Assisted', 'Face Recognition', 'Biometric', 'RFID', 'QR Code');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_roles_enum') THEN
        CREATE TYPE user_roles_enum AS ENUM (
            'Directorate Admin', 
            'Principal', 
            'College Admin', 
            'Teacher', 
            'Student', 
            'System Administrator'
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
        CREATE TYPE attendance_status_enum AS ENUM (
            'Present', 
            'Absent', 
            'Late', 
            'Leave'
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type_enum') THEN
        CREATE TYPE leave_type_enum AS ENUM (
            'Casual Leave', 
            'Sick Leave', 
            'Earned Leave', 
            'Duty Leave', 
            'Special Leave'
        );
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

---------------------------------------------------------
-- 1. Institutions
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS institutions (
    id SERIAL PRIMARY KEY,
    institution_code VARCHAR(50) UNIQUE NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    institution_type VARCHAR(100),
    district VARCHAR(100),
    state VARCHAR(100),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    pin_code VARCHAR(10),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

);

---------------------------------------------------------
-- 2. Departments
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    department_name VARCHAR(255) NOT NULL,
    department_code VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 3. Courses
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    department_id INT REFERENCES departments(id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50),
    course_type VARCHAR(50),
    duration_years INT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 4. Semesters
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS semesters (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    semester_name VARCHAR(100) NOT NULL,
    semester_number INT NOT NULL,
    academic_year VARCHAR(20),
    is_active BOOLEAN
);

---------------------------------------------------------
-- 5. Subjects
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
    subject_code VARCHAR(50) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    subject_type VARCHAR(50),
    credit DECIMAL(4,2),
    is_active BOOLEAN
);

---------------------------------------------------------
-- 6. Classes
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
    section_name VARCHAR(50),
    academic_year VARCHAR(20),
    is_active BOOLEAN
);


---------------------------------------------------------
-- 7. UserRoles
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    role_name user_roles_enum NOT NULL,
    role_description VARCHAR(300)
);

---------------------------------------------------------
-- 8. Users
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    institution_id INT REFERENCES institutions(id) ON DELETE SET NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(500) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    mobile_no VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    user_role_id INT REFERENCES user_roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 9. Students
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id),
    department_id INT REFERENCES departments(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    semester_id INT REFERENCES semesters(id) ON DELETE CASCADE,
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    registration_no VARCHAR(100) UNIQUE,
    roll_no VARCHAR(50),
    student_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20),
    date_of_birth DATE,
    mobile_no VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    guardian_name VARCHAR(255),
    guardian_mobile_no VARCHAR(20),
    address VARCHAR(500),
    admission_year INT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 10. Teachers
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id),
    department_id INT REFERENCES departments(id) ON DELETE CASCADE,
    employee_code VARCHAR(100),
    teacher_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    qualification VARCHAR(255),
    mobile_no VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    joining_date DATE,
    employment_type VARCHAR(50),
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP 
);

---------------------------------------------------------
-- 11. Principals
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS principals (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id),
    principal_name VARCHAR(255) NOT NULL,
    mobile_no VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    joining_date DATE,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 12. Teacher Subject Mapping
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS teacher_subject_mapping (
    id SERIAL PRIMARY KEY,
    teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    subject_id INT REFERENCES subjects(id) ON DELETE CASCADE,
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20),
    is_active BOOLEAN
);

---------------------------------------------------------
-- 13. Student Class Mapping
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_class_mapping (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20),
    is_active BOOLEAN
);

---------------------------------------------------------
-- 14. Attendance Sessions
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id SERIAL PRIMARY KEY,
    institution_id INT REFERENCES institutions(id),
    class_id INT REFERENCES classes(id),
    subject_id INT REFERENCES subjects(id),
    teacher_id INT REFERENCES teachers(id),
    attendance_date DATE NOT NULL,
    session_start_time TIME,
    session_end_time TIME,
    attendance_mode attendance_mode_enum,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    location_accuracy DECIMAL(10, 2),
    classroom_photo_path VARCHAR(500),
    device_id VARCHAR(200),
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 15. Student Attendance
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_attendance (
    id SERIAL PRIMARY KEY,
    attendance_session_id INT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    attendance_status attendance_status_enum,
    marked_by_teacher_id INT REFERENCES teachers(id) ON DELETE SET NULL,
    is_ai_recognized BOOLEAN,
    recognition_confidence DECIMAL(5, 2) NULL,
    face_match_status VARCHAR(50) NULL,
    remarks VARCHAR(300) NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 16. Teacher Attendance
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_attendance (
    id SERIAL PRIMARY KEY,
    teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    attendance_status VARCHAR(30),
    marked_by_principal_id INT REFERENCES principals(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    photo_path VARCHAR(500) NULL,
    device_id VARCHAR(200),
    remarks VARCHAR(300) NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 17. Face Enrollment
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS face_enrollment (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(50),
    enrollment_date DATE,
    enrolled_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN,
    remarks VARCHAR(300) NULL
);

---------------------------------------------------------
-- 18. Face Embeddings
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS face_embedding (
    id SERIAL PRIMARY KEY,
    face_enrollment_id INT REFERENCES face_enrollment(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    embedding_vector VECTOR(128),
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    embedding_hash VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN
);

---------------------------------------------------------
-- 20. Academic Calendar
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS academic_calendar (
    id SERIAL PRIMARY KEY,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    academic_year VARCHAR(20),
    event_title VARCHAR(200),
    event_type VARCHAR(100),
    event_date DATE NOT NULL,
    end_date DATE NULL,
    description VARCHAR(500),
    created_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN
);


---------------------------------------------------------
-- 21. Leave Types
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    leave_type_name leave_type_enum,
    description VARCHAR(300),
    is_active BOOLEAN
);

---------------------------------------------------------
-- 22. Leave Applications
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_applications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    institution_id INT REFERENCES institutions(id) ON DELETE CASCADE,
    leave_type_id INT REFERENCES leave_types(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days DECIMAL(5,2),
    reason VARCHAR(500),
    attachment_path VARCHAR(500) NULL,
    application_status VARCHAR(30),
    approved_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason VARCHAR(500) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 23. User Devices
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(200) UNIQUE,
    device_name VARCHAR(200),
    device_os VARCHAR(100),
    app_version VARCHAR(50),
    is_approved BOOLEAN,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 24. Login Logs
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    device_id VARCHAR(200),
    login_status VARCHAR(50)
);
---------------------------------------------------------
-- 25. AI Session Processing
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_session_processing (
    id SERIAL PRIMARY KEY,
    attendance_session_id INT REFERENCES attendance_sessions(id),
    total_faces_detected INT,
    total_faces_recognized INT,
    total_unrecognized_faces INT,
    processing_status VARCHAR(50),
    processing_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message VARCHAR(1000) NULL
);

---------------------------------------------------------
-- 26. System Settings  
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NULL,
    description VARCHAR(300),
    updated_by_user_id INT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------
-- 27. File Uploads
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    uploaded_by_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    institution_id INT NULL,
    file_type VARCHAR(100),
    file_name VARCHAR(300),
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    file_size_kb DECIMAL(12,2),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN
);

---------------------------------------------------------
-- 28. Face Recognition Logs
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS face_recognition_logs (
    id SERIAL PRIMARY KEY,
    attendance_session_id INT REFERENCES attendance_sessions(id),
    student_id INT REFERENCES students(id),
    teacher_id INT REFERENCES teachers(id),
    detected_face_image_path VARCHAR(500) NULL,
    recognition_status VARCHAR(50),
    confidence_score DECIMAL(5,2),
    matched_face_enrollment_id INT REFERENCES face_enrollment(id),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks VARCHAR(300) NULL
);

---------------------------------------------------------
-- 29. Audit Logs
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100),
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_value TEXT NULL,
    new_value TEXT NULL,
    ip_address VARCHAR(50) NULL,
    device_id VARCHAR(200) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
---------------------------------------------------------
-- 30. Notifications
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    message VARCHAR(1000),
    notification_type VARCHAR(100),
    is_read BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

