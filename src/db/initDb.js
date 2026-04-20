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
      console.log("🗑️  Dropping existing tables...");
      const tables = [
        "audit_logs",
        "device_registry",
        "attendance_exceptions",
        "attendance_policies",
        "geofences",
        "attendance_daily_summary",
        "attendance_logs",
        "face_templates",
        "enrollment_samples",
        "enrollment_sessions",
        "employees",
        "shifts",
        "departments",
        "offices",
        "users",
      ];
      for (const table of tables) {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }
      console.log("✅ Tables dropped");
    }

    console.log("⏳ Initializing database schema...");

    const schemaPath = path.join(__dirname, "schema.sql");
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
