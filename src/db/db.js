/**
 * PostgreSQL Connection Pool
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Optimization for development
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection immediately on startup
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('🐘 PostgreSQL connected successfully');
    client.release();
  } catch (err) {
    console.error('❌ PostgreSQL Connection Error:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Fail fast in production
    }
  }
};

testConnection();

pool.on('error', (err) => {
  console.error('❌ PostgreSQL Pool Error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
