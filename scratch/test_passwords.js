
const bcrypt = require('bcryptjs');

const hash = '$2a$10$GMDeFCwfVMYw5f8f55JiH.BadiRy0ZfK6G85Cqef/b9rpjimIpy4a';
const passwords = ['Admin@1234', 'password123', 'Password123', 'admin123'];

async function testPasswords() {
  for (const pw of passwords) {
    const match = await bcrypt.compare(pw, hash);
    console.log(`Password "${pw}": ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
  }
}

testPasswords();
