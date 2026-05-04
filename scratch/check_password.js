const bcrypt = require('bcryptjs');

const hash = '$2a$10$GMDeFCwfVMYw5f8f55JiH.BadiRy0ZfK6G85Cqef/b9rpjimIpy4a';
const passwords = ['password123', 'Admin@1234', '123456', 'password'];

async function check() {
  for (const pw of passwords) {
    const match = await bcrypt.compare(pw, hash);
    if (match) {
      console.log(`Hash matches: ${pw}`);
      return;
    }
  }
  console.log('No matches found in common passwords.');
}

check();
