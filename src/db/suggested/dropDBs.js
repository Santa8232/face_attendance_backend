/**
 * Dynamic Database Wipe Script
 * Automatically finds all existing tables and drops them.
 */

const { pool } = require("../db");

const dropTables = async () => {
  try {
    console.log("🔍 Fetching all existing tables...");

    // Query to find all tables in the 'public' schema
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `;

    const { rows } = await pool.query(query);

    if (rows.length === 0) {
      console.log("✅ No tables found. Database is already empty.");
      process.exit(0);
    }

    console.log(`🗑️  Found ${rows.length} tables. Starting teardown...`);

    for (const row of rows) {
      const tableName = row.table_name;
      // Using CASCADE to handle foreign key dependencies automatically
      await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      console.log(`   - Dropped: ${tableName}`);
    }

    console.log("\n✨ Database is now completely empty.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error clearing database:", err.message);
    process.exit(1);
  }
};

dropTables();