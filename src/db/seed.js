/**
 * Seed script – run once to create an admin user and demo data.
 * Usage:  node src/db/seed.js
 */

const bcrypt = require('bcryptjs');
const store = require('./store');
const { TABLES } = store;

async function seed() {
  console.log('🌱  Seeding PostgreSQL store …');

  try {
    // ── 1. Default Role ────────────────────────────────────────────────────────
    let role = await store.findOne(TABLES.USER_ROLES, r => r.role_name === 'System Administrator');
    if (!role) {
      role = await store.insert(TABLES.USER_ROLES, {
        role_name: 'System Administrator',
        role_description: 'System Administrator'
      });
      console.log('  ✔ Admin role created');
    }

    // ── 2. Institution ────────────────────────────────────────────────────────────
    let inst = await store.findOne(TABLES.OFFICES, o => o.institution_name === 'Main Campus');
    if (!inst) {
      inst = await store.insert(TABLES.OFFICES, {
        institution_name: 'Main Campus',
        institution_code: 'MC001',
        address:     '123 Main Street',
        district:    'Mumbai',
        state:       'Maharashtra',
        is_active:   true,
      });
      console.log('  ✔ Institution "Main Campus" created');
    }

    // ── 3. Admin user ────────────────────────────────────────────────────────
    const existingAdmin = await store.findOne(TABLES.USERS, u => u.email === 'admin@example.com');
    if (!existingAdmin) {
      const hash = await bcrypt.hash('Admin@1234', 10);
      await store.insert(TABLES.USERS, {
        institution_id: inst.id,
        username:   'admin',
        email:      'admin@example.com',
        password_hash: hash,
        user_role_id: role.id,
        is_active:  true,
        full_name:  'System Administrator'
      });
      console.log('  ✔ Admin user created (admin / Admin@1234)');
    } else {
      console.log('  – Admin user already exists');
    }

    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeding Failed:', err.stack);
    process.exit(1);
  }
}

seed();
