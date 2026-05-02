
const store = require('../src/db/store');
const { TABLES } = store;

async function debugLogin() {
  const username = 'prof_smith';
  console.log(`Checking for user: ${username}`);
  
  try {
    const user = await store.findOne(TABLES.USERS, u =>
      u.email === username.toLowerCase().trim() || u.username === username.trim()
    );

    if (!user) {
      console.log('❌ User not found in database.');
      
      const allUsers = await store.getAll(TABLES.USERS);
      console.log('Available users:', allUsers.map(u => ({ email: u.email, username: u.username, hasPassword: !!u.password })));
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      username: user.username,
      keys: Object.keys(user)
    });

    if (user.password === undefined) {
      console.log('🚨 ERROR: password field is UNDEFINED!');
      if (user.password_hash) {
        console.log('💡 FOUND password_hash instead! mapping issue detected.');
      }
    }
  } catch (err) {
    console.error('Diagnostic failed:', err);
  }
}

debugLogin();
