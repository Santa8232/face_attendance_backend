/**
 * Migration Script – Seed PostgreSQL from JSON files in /data
 * Usage: node src/db/migrateData.js
 */

const fs = require('fs');
const path = require('path');
const store = require('../suggested/store_suggested');
const { TABLES } = store;

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

const loadJson = (filename) => {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const migrate = async () => {
  // Mapping object to store old_id -> new_uuid translations for FK integrity
  const mapping = {
    institutions: {},
    departments: {},
    courses: {},
    semesters: {},
    subjects: {},
    classes: {},
    user_roles: {},
    users: {},
    students: {},
    teachers: {},
    principals: {},
    face_enrollment: {},
  };

  try {
    console.log('🚀 Starting Academic System migration to PostgreSQL...');

    // 1. Institutions (The Root)
    const institutions = loadJson('institutions.json');
    console.log(`  - Migrating ${institutions.length} institutions...`);
    for (const inst of institutions) {
      const { id, district, state, pin_code, latitude, longitude, ...data } = inst;
      const res = await store.insert(TABLES.INSTITUTIONS, { ...data });
      mapping.institutions[id] = res.id;
    }

    // 2. User Roles
    const roles = loadJson('user_roles.json');
    console.log(`  - Migrating ${roles.length} roles...`);
    for (const role of roles) {
      const { id, role_description, ...data } = role;
      const res = await store.insert(TABLES.USER_ROLES, { ...data });
      mapping.user_roles[id] = res.id;
    }

    // 3. Departments
    const depts = loadJson('departments.json');
    console.log(`  - Migrating ${depts.length} departments...`);
    for (const dept of depts) {
      const { id, institution_id, ...data } = dept;
      const res = await store.insert(TABLES.DEPARTMENTS, {
        ...data,
        institution_id: mapping.institutions[institution_id]
      });
      mapping.departments[id] = res.id;
    }

    // 4. Courses
    const courses = loadJson('courses.json');
    console.log(`  - Migrating ${courses.length} courses...`);
    for (const course of courses) {
      const { id, institution_id, department_id, course_type, duration_years, is_active, created_at, ...data } = course;
      const res = await store.insert(TABLES.COURSES, {
        ...data,
        institution_id: mapping.institutions[institution_id],
        department_id: mapping.departments[department_id]
      });
      mapping.courses[id] = res.id;
    }

    // 5. Users
    const users = loadJson('users.json');
    console.log(`  - Migrating ${users.length} users...`);
    for (const user of users) {
      const { id, institution_id, user_role_id, ...data } = user;
      const res = await store.insert(TABLES.USERS, {
        ...data,
        institution_id: mapping.institutions[institution_id],
        user_role_id: mapping.user_roles[user_role_id]
      });
      mapping.users[id] = res.id;
    }

    // 6. Semesters
    const semesters = loadJson('semesters.json');
    console.log(`  - Migrating ${semesters.length} semesters...`);
    for (const sem of semesters) {
      const { id, course_id, academic_year, is_active, created_at, ...data } = sem;
      const res = await store.insert(TABLES.SEMESTERS, {
        ...data,
        course_id: mapping.courses[course_id]
      });
      mapping.semesters[id] = res.id;
    }

    // 7. Classes
    const classes = loadJson('classes.json');
    console.log(`  - Migrating ${classes.length} classes...`);
    for (const cls of classes) {
      const { id, institution_id, course_id, semester_id, is_active, created_at, ...data } = cls;
      const res = await store.insert(TABLES.CLASSES, {
        ...data,
        institution_id: mapping.institutions[institution_id],
        course_id: mapping.courses[course_id],
        semester_id: mapping.semesters[semester_id]
      });
      mapping.classes[id] = res.id;
    }

    // 8. Students
    const students = loadJson('students.json');
    console.log(`  - Migrating ${students.length} students...`);
    for (const std of students) {
      const { id, user_id, institution_id, class_id, ...data } = std;
      const res = await store.insert(TABLES.STUDENTS, {
        ...data,
        user_id: mapping.users[user_id],
        institution_id: mapping.institutions[institution_id],
        class_id: mapping.classes[class_id]
      });
      mapping.students[id] = res.id;
    }

    // 9. Teachers
    const teachers = loadJson('teachers.json');
    console.log(`  - Migrating ${teachers.length} teachers...`);
    for (const t of teachers) {
      const { id, user_id, institution_id, ...data } = t;
      const res = await store.insert(TABLES.TEACHERS, {
        ...data,
        user_id: mapping.users[user_id],
        institution_id: mapping.institutions[institution_id]
      });
      mapping.teachers[id] = res.id;
    }

    // 10. Face Enrollment
    const enrollments = loadJson('face_enrollment.json');
    console.log(`  - Migrating ${enrollments.length} face enrollments...`);
    for (const fe of enrollments) {
      const { id, user_id, student_id, institution_id, enrollment_date, enrolled_by_user_id, remarks, ...data } = fe;
      const res = await store.insert(TABLES.FACE_ENROLLMENT, {
        ...data,
        user_id: mapping.users[user_id]
      });
      mapping.face_enrollment[id] = res.id;
    }

    console.log('\n✅ Academic Data Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration Failed:', err.stack);
    process.exit(1);
  }
};

migrate();