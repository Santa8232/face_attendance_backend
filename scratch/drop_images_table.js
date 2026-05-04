const { query } = require('../src/db/db');

async function dropTable() {
  try {
    console.log('Dropping face_enrollment_images table...');
    await query('DROP TABLE IF EXISTS face_enrollment_images CASCADE');
    console.log('Dropping image_angle_enum type...');
    await query('DROP TYPE IF EXISTS image_angle_enum CASCADE');
    console.log('Successfully removed table and enum.');
    process.exit(0);
  } catch (err) {
    console.error('Error dropping table:', err);
    process.exit(1);
  }
}

dropTable();
