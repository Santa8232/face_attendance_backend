/**
 * Database Initialization Script
 * Runs the schema.sql file against the configured PostgreSQL database.
 */

const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const initDb = async () => {
  try {
    const isReset = process.argv.includes("--reset");

    if (isReset) {
      console.log("🗑️  Dropping existing tables (Reverse Dependency Order)...");
      
      // Tables listed from most dependent (children) to least dependent (parents)
      const tables = [
        // 1. Educational Structure Tables
        "institutions",
        "departments",
        "courses",
        "semesters",
        "subjects",
        "classes",

        // 2. User & Personnel Tables
        "users",
        "user_roles",
        "students",
        "teachers",
        "principals",

        // 3. Mappings & Attendance Tables
        "teacher_subject_mapping",
        "student_class_mapping",
        "attendance_sessions",
        "student_attendance",
        "teacher_attendance",

        // 4. Leave, Calendar & Security Tables
        "leave_applications",
        "leave_types",
        "academic_calendar",


        
        // 5. AI Face Recognition Tables
        "face_enrollment",
        "face_embedding",
        "face_enrollment_images",
        "face_recognition_logs",
        "ai_session_processing",
        
        // Device, Security and Audit 
        "user_devices",
        "login_logs",
        "audit_logs",
        "system_settings",
        "file_uploads",
        "notifications",

        // enum
        
      ];

      for (const table of tables) {
        // CASCADE is kept as a safety measure for complex relations
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }
      console.log("✅ Tables dropped");

      // Drop Custom Types
      await pool.query(`DROP TYPE IF EXISTS attendance_mode_enum CASCADE`);
      console.log("✅ Custom Types dropped");
    }

    console.log("⏳ Initializing database schema...");

    const schemaPath = path.join(__dirname, "schema.sql");
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schemaSql);

    console.log("✅ Database schema initialized successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Database Initialization Failed:", err.message);
    process.exit(1);
  }
};

initDb();