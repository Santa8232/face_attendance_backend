const { pool } = require('./src/db/db');

async function checkTemplate() {
  try {
    const { rows } = await pool.query('SELECT id, employee_id, aggregate_embedding, is_active FROM face_templates WHERE employee_id = 1');
    console.log('Templates for Employee 1:');
    rows.forEach(row => {
      console.log(`ID: ${row.id}, Active: ${row.is_active}, Embedding Type: ${typeof row.aggregate_embedding}, Embedding Length: ${row.aggregate_embedding ? (Array.isArray(row.aggregate_embedding) ? row.aggregate_embedding.length : 'Not an array') : 'null'}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTemplate();
