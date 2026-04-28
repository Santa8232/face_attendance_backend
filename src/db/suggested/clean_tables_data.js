/**
 * Database Data Clear Script
 * Truncates all tables in the public schema and resets their identities.
 */

const { pool } = require("../db");

const cleanTablesData = async () => {
  try {
    console.log("🔍 Fetching all tables to clear data...");

    const queryStr = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `;

    const { rows } = await pool.query(queryStr);

    if (rows.length === 0) {
      console.log("✅ No tables found in the public schema.");
      process.exit(0);
    }

    // Filter out common system tables if any, though information_schema already handles it
    const tablesToClear = rows.map(r => `"${r.table_name}"`).join(", ");
    
    console.log(`🧹 Clearing data from ${rows.length} tables: ${rows.map(r => r.table_name).join(", ")}`);

    // Using TRUNCATE with RESTART IDENTITY to reset SERIAL counters to 1
    // CASCADE handles foreign key constraints automatically
    await pool.query(`TRUNCATE TABLE ${tablesToClear} RESTART IDENTITY CASCADE`);

    console.log("\n✨ All table data has been cleared and identities have been reset.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error clearing table data:", err.message);
    process.exit(1);
  }
};

cleanTablesData();