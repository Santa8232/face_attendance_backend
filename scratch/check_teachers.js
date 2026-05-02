
const store = require('../src/db/store');
const { TABLES } = store;

async function checkTeachers() {
  try {
    const users = await store.findOne(TABLES.USERS, u => u.username === 'prof_smith');
    console.log('User in DB:', users);
    
    const teacher = await store.findOne(TABLES.EMPLOYEES, e => e.user_id === users.id);
    console.log('Teacher for prof_smith:', teacher);
    
    if (!teacher) {
      console.log('🚨 ERROR: No teacher record linked to user id', users.id);
      const allTeachers = await store.getAll(TABLES.EMPLOYEES);
      console.log('Total teachers in DB:', allTeachers.length);
    }
  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    process.exit();
  }
}

checkTeachers();
