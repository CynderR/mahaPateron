const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { initDatabase, createUser, getUserByUsername } = require('./database');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'p1assword2';
const ADMIN_EMAIL = 'admin@4thstate.ca';

async function createAdminUser() {
  try {
    await initDatabase();

    const existing = await getUserByUsername(ADMIN_USERNAME);
    if (existing) {
      console.log('Admin user already exists, skipping creation.');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const user = await createUser({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      patreon_id: null,
      is_mixcloud: false,
      is_free: false,
      is_admin: true
    });

    console.log('Admin user created successfully. ID:', user.id);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
