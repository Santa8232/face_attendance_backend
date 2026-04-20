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
  const mapping = {
    users: {},
    offices: {},
    departments: {},
    shifts: {},
    employees: {},
    sessions: {},
  };

  try {
    console.log('🚀 Starting migration from JSON to PostgreSQL...');

    // 1. Users
    const users = loadJson('users.json');
    console.log(`  - Migrating ${users.length} users...`);
    for (const user of users) {
      const { user_id, ...data } = user;
      const res = await store.insert(TABLES.USERS, { ...data, user_id });
      mapping.users[user_id] = res.id;
    }

    // 2. Offices
    const offices = loadJson('offices.json');
    console.log(`  - Migrating ${offices.length} offices...`);
    for (const office of offices) {
      const { office_id, ...data } = office;
      const res = await store.insert(TABLES.OFFICES, { ...data, office_id });
      mapping.offices[office_id] = res.id;
    }

    // 3. Departments
    const departments = loadJson('departments.json');
    console.log(`  - Migrating ${departments.length} departments...`);
    for (const dept of departments) {
      const { department_id, office_id, ...data } = dept;
      const res = await store.insert(TABLES.DEPARTMENTS, {
        ...data,
        department_id,
        office_id: mapping.offices[office_id] || null
      });
      mapping.departments[department_id] = res.id;
    }

    // 4. Shifts
    const shifts = loadJson('shifts.json');
    console.log(`  - Migrating ${shifts.length} shifts...`);
    for (const shift of shifts) {
      const { shift_id, office_id, ...data } = shift;
      const res = await store.insert(TABLES.SHIFTS, {
        ...data,
        shift_id,
        office_id: mapping.offices[office_id] || null
      });
      mapping.shifts[shift_id] = res.id;
    }

    // 5. Employees
    const employees = loadJson('employees.json');
    console.log(`  - Migrating ${employees.length} employees...`);
    for (const emp of employees) {
      const { employee_id, user_id, office_id, department_id, shift_id, ...data } = emp;
      const res = await store.insert(TABLES.EMPLOYEES, {
        ...data,
        employee_id,
        user_id: mapping.users[user_id] || null,
        office_id: mapping.offices[office_id] || null,
        department_id: mapping.departments[department_id] || null,
        shift_id: mapping.shifts[shift_id] || null,
      });
      mapping.employees[employee_id] = res.id;
    }

    // 6. Geofences
    const geofences = loadJson('geofences.json');
    console.log(`  - Migrating ${geofences.length} geofences...`);
    for (const geo of geofences) {
      const { geofence_id, office_id, ...data } = geo;
      await store.insert(TABLES.GEOFENCES, {
        ...data,
        geofence_id,
        office_id: mapping.offices[office_id] || null
      });
    }

    // 7. Attendance Policies
    const policies = loadJson('attendance_policies.json');
    console.log(`  - Migrating ${policies.length} policies...`);
    for (const p of policies) {
      const { policy_id, office_id, ...data } = p;
      await store.insert(TABLES.ATTENDANCE_POLICIES, {
        ...data,
        policy_id,
        office_id: mapping.offices[office_id] || null
      });
    }

    // 8. Device Registry
    const devices = loadJson('device_registry.json');
    console.log(`  - Migrating ${devices.length} devices...`);
    for (const device of devices) {
      const { device_registry_id, employee_id, ...data } = device;
      await store.insert(TABLES.DEVICE_REGISTRY, {
        ...data,
        device_registry_id,
        employee_id: mapping.employees[employee_id] || null
      });
    }

    // 9. Audit Logs
    const auditLogs = loadJson('audit_logs.json');
    console.log(`  - Migrating ${auditLogs.length} audit logs...`);
    for (const log of auditLogs) {
      const { audit_id, actor_user_id, ...data } = log;
      await store.insert(TABLES.AUDIT_LOGS, {
        ...data,
        audit_id,
        actor_user_id: mapping.users[actor_user_id] || null
      });
    }

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration Failed:', err.stack);
    process.exit(1);
  }
};

migrate();
