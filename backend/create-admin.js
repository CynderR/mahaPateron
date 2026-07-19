const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { initDatabase, createUser, getUserByUsername } = require('./database');
const { validatePassword } = require('./utils/passwordPolicy');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@4thstate.ca';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function createAdminUser() {
  try {
    if (!ADMIN_PASSWORD) {
      console.error(
        'Set ADMIN_PASSWORD in backend/.env (or the environment) before running create-admin.js.\n' +
          'Optional: ADMIN_USERNAME, ADMIN_EMAIL.'
      );
      process.exit(1);
    }

    const passwordError = validatePassword(ADMIN_PASSWORD);
    if (passwordError) {
      console.error(passwordError);
      process.exit(1);
    }

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
      is_free: false,
      is_admin: true,
      is_paying: true
    });

    console.log('Admin user created successfully. ID:', user.id);
    console.log(`Username: ${ADMIN_USERNAME}`);
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log('Password was taken from ADMIN_PASSWORD (not printed).');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
