/**
 * Seed script – run once to create an admin user and demo data.
 * Usage:  node src/db/seed.js
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store  = require('./store');
const { TABLES } = store;

async function seed() {
  console.log('🌱  Seeding PostgreSQL store …');

  // ── 1. Admin user ────────────────────────────────────────────────────────
  const existingAdmin = await store.findOne(TABLES.USERS, u => u.email === 'admin@company.com');
  if (!existingAdmin) {
    const hash = await bcrypt.hash('Admin@1234', 10);
    await store.insert(TABLES.USERS, {
      user_id:    uuidv4(),
      email:      'admin@company.com',
      password:   hash,
      role:       'ADMIN',
      is_active:  true,
      created_at: new Date().toISOString(),
    });
    console.log('  ✔ Admin user created  (admin@company.com / Admin@1234)');
  } else {
    console.log('  – Admin user already exists');
  }

  // ── 2. Office ────────────────────────────────────────────────────────────
  let office = await store.findOne(TABLES.OFFICES, o => o.office_name === 'HQ');
  if (!office) {
    office = await store.insert(TABLES.OFFICES, {
      office_id:   uuidv4(),
      office_name: 'HQ',
      address:     '123 Main Street',
      city:        'Mumbai',
      country:     'India',
      timezone:    'Asia/Kolkata',
      is_active:   true,
      created_at:  new Date().toISOString(),
    });
    console.log('  ✔ Office "HQ" created');
  } else {
    console.log('  – Office already exists');
  }

  // ── 3. Department ────────────────────────────────────────────────────────
  let dept = await store.findOne(TABLES.DEPARTMENTS, d => d.department_name === 'Engineering');
  if (!dept) {
    dept = await store.insert(TABLES.DEPARTMENTS, {
      department_id:   uuidv4(),
      department_name: 'Engineering',
      office_id:       office.office_id,
      created_at:      new Date().toISOString(),
    });
    console.log('  ✔ Department "Engineering" created');
  } else {
    console.log('  – Department already exists');
  }

  // ── 4. Default shift ─────────────────────────────────────────────────────
  let shift = await store.findOne(TABLES.SHIFTS, s => s.shift_name === 'Day Shift');
  if (!shift) {
    shift = await store.insert(TABLES.SHIFTS, {
      shift_id:         uuidv4(),
      office_id:        office.office_id,
      shift_name:       'Day Shift',
      start_time:       '09:00',
      end_time:         '18:00',
      grace_minutes:    15,
      is_active:        true,
      created_at:       new Date().toISOString(),
    });
    console.log('  ✔ Shift "Day Shift" created');
  } else {
    console.log('  – Shift already exists');
  }

  // ── 5. Geofence for office ───────────────────────────────────────────────
  const existingGeo = await store.findOne(TABLES.GEOFENCES, g => g.office_id === office.office_id);
  if (!existingGeo) {
    await store.insert(TABLES.GEOFENCES, {
      geofence_id:   uuidv4(),
      office_id:     office.office_id,
      geofence_name: 'HQ Perimeter',
      latitude:      19.0760,
      longitude:     72.8777,
      radius_m:      200,
      is_active:     true,
      created_at:    new Date().toISOString(),
    });
    console.log('  ✔ Geofence for HQ created');
  } else {
    console.log('  – Geofence already exists');
  }

  // ── 6. Attendance policy ─────────────────────────────────────────────────
  const existingPolicy = await store.findOne(TABLES.ATTENDANCE_POLICIES, p => p.office_id === office.office_id);
  if (!existingPolicy) {
    await store.insert(TABLES.ATTENDANCE_POLICIES, {
      policy_id:             uuidv4(),
      office_id:             office.office_id,
      require_face_match:    true,
      require_liveness:      true,
      require_geofence:      true,
      allow_offline:         true,
      max_offline_hours:     12,
      allow_field_mode:      false,
      max_daily_attempts:    10,
      duplicate_window_sec:  120,
      created_at:            new Date().toISOString(),
    });
    console.log('  ✔ Attendance policy created');
  } else {
    console.log('  – Policy already exists');
  }

  // ── 7. Demo employee ─────────────────────────────────────────────────────
  const existingEmp = await store.findOne(TABLES.EMPLOYEES, e => e.email === 'emp01@company.com');
  if (!existingEmp) {
    const empHash = await bcrypt.hash('Emp@1234', 10);
    const empUser = await store.insert(TABLES.USERS, {
      user_id:    uuidv4(),
      email:      'emp01@company.com',
      password:   empHash,
      role:       'EMPLOYEE',
      is_active:  true,
      created_at: new Date().toISOString(),
    });
    await store.insert(TABLES.EMPLOYEES, {
      employee_id:     uuidv4(),
      user_id:         empUser.user_id,
      office_id:       office.office_id,
      department_id:   dept.department_id,
      shift_id:        shift.shift_id,
      employee_code:   'EMP001',
      full_name:       'Demo Employee',
      email:           'emp01@company.com',
      phone:           '9999999999',
      designation:     'Software Engineer',
      employment_type: 'FULL_TIME',
      is_active:       true,
      face_enrolled:   false,
      created_at:      new Date().toISOString(),
    });
    console.log('  ✔ Demo employee created  (emp01@company.com / Emp@1234)');
  } else {
    console.log('  – Demo employee already exists');
  }

  console.log('\n✅  Seed complete.');
}

seed().catch(console.error);
