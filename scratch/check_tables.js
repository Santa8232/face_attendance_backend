
const { pool } = require('../src/db/db');

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in database:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Failed to check tables:', err);
  } finally {
    process.exit();
  }
}

checkTables();
