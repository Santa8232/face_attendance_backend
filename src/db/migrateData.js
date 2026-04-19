/**
 * Migration Script – Seed PostgreSQL from JSON files in /data
 * Usage: node src/db/migrateData.js
 */

const fs = require('fs');
const path = require('path');
const store = require('./store');
const { TABLES } = store;

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const loadJson = (filename) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const migrate = async () => {
  try {
    console.log('🚀 Starting migration from JSON to PostgreSQL...');

    // 1. Users
    const users = loadJson('users.json');
    console.log(`  - Migrating ${users.length} users...`);
    for (const user of users) {
      await store.insert(TABLES.USERS, user);
    }

    // 2. Offices
    const offices = loadJson('offices.json');
    console.log(`  - Migrating ${offices.length} offices...`);
    for (const office of offices) {
      await store.insert(TABLES.OFFICES, office);
    }

    // 3. Departments
    const departments = loadJson('departments.json');
    console.log(`  - Migrating ${departments.length} departments...`);
    for (const dept of departments) {
      await store.insert(TABLES.DEPARTMENTS, dept);
    }

    // 4. Shifts
    const shifts = loadJson('shifts.json');
    console.log(`  - Migrating ${shifts.length} shifts...`);
    for (const shift of shifts) {
      await store.insert(TABLES.SHIFTS, shift);
    }

    // 5. Employees
    const employees = loadJson('employees.json');
    console.log(`  - Migrating ${employees.length} employees...`);
    
    // Fetch valid IDs for FK checks
    const validUsers = (await store.getAll(TABLES.USERS)).map(u => u.user_id);
    const validOffices = (await store.getAll(TABLES.OFFICES)).map(o => o.office_id);
    const validDepts = (await store.getAll(TABLES.DEPARTMENTS)).map(d => d.department_id);
    const validShifts = (await store.getAll(TABLES.SHIFTS)).map(s => s.shift_id);

    for (const emp of employees) {
      if (!validUsers.includes(emp.user_id)) {
        console.warn(`    ⚠️ Skipping employee ${emp.employee_code}: User ID ${emp.user_id} not found.`);
        continue;
      }
      if (!validOffices.includes(emp.office_id)) {
        console.warn(`    ⚠️ Skipping employee ${emp.employee_code}: Office ID ${emp.office_id} not found.`);
        continue;
      }
      // Note: department_id and shift_id are also FKs but might be optional in some cases
      // For this migration, we'll enforce them if present in JSON
      if (emp.department_id && !validDepts.includes(emp.department_id)) {
        console.warn(`    ⚠️ Skipping employee ${emp.employee_code}: Dept ID ${emp.department_id} not found.`);
        continue;
      }
      if (emp.shift_id && !validShifts.includes(emp.shift_id)) {
        console.warn(`    ⚠️ Skipping employee ${emp.employee_code}: Shift ID ${emp.shift_id} not found.`);
        continue;
      }

      await store.insert(TABLES.EMPLOYEES, emp);
    }

    // 6. Geofences
    const geofences = loadJson('geofences.json');
    console.log(`  - Migrating ${geofences.length} geofences...`);
    for (const geo of geofences) {
      if (!validOffices.includes(geo.office_id)) {
        console.warn(`    ⚠️ Skipping geofence ${geo.geofence_name}: Office ID ${geo.office_id} not found.`);
        continue;
      }
      await store.insert(TABLES.GEOFENCES, geo);
    }

    // 7. Attendance Policies
    const policies = loadJson('attendance_policies.json');
    console.log(`  - Migrating ${policies.length} policies...`);
    for (const policy of policies) {
      if (!validOffices.includes(policy.office_id)) {
        console.warn(`    ⚠️ Skipping policy for Office ID ${policy.office_id}: Office not found.`);
        continue;
      }
      await store.insert(TABLES.ATTENDANCE_POLICIES, policy);
    }

    // 8. Device Registry
    const devices = loadJson('device_registry.json');
    console.log(`  - Migrating ${devices.length} devices...`);
    const validEmployees = (await store.getAll(TABLES.EMPLOYEES)).map(e => e.employee_id);
    for (const device of devices) {
      if (!validEmployees.includes(device.employee_id)) {
        console.warn(`    ⚠️ Skipping device ${device.device_id}: Employee ID ${device.employee_id} not found.`);
        continue;
      }
      await store.insert(TABLES.DEVICE_REGISTRY, device);
    }

    // 9. Audit Logs
    const auditLogs = loadJson('audit_logs.json');
    console.log(`  - Migrating ${auditLogs.length} audit logs...`);
    // Batch audit logs if there are many, but for now loop is fine for small data
    for (const log of auditLogs) {
      await store.insert(TABLES.AUDIT_LOGS, log);
    }

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration Failed:', err.message);
    process.exit(1);
  }
};

migrate();
