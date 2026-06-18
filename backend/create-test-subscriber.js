const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { BASE_URL } = require('./config');
const {
  initDatabase,
  createUser,
  getUserByUsername,
  getUserById,
  updateUserFields
} = require('./database');

// Comped member: full RSS + streaming access without Stripe billing.
const TEST_USERNAME = 'testmember';
const TEST_EMAIL = 'test@4thstate.ca';
const TEST_PASSWORD = 'testpassword1';

const SUBSCRIBER_FIELDS = {
  is_paying: 1,
  payment_category: 'free',
  access_type: 'both',
  is_admin: 0,
  is_free: 0,
  subscription_price: null,
  monthly_payments: 0
};

async function createTestSubscriber() {
  try {
    await initDatabase();

    const existing = await getUserByUsername(TEST_USERNAME);
    if (existing) {
      await updateUserFields(existing.id, SUBSCRIBER_FIELDS);
      const user = await getUserById(existing.id);
      console.log('Test subscriber already exists — subscription flags refreshed.');
      printDetails(user);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
    const created = await createUser({
      username: TEST_USERNAME,
      email: TEST_EMAIL,
      password: hashedPassword,
      is_free: false,
      is_admin: false,
      is_paying: true,
      payment_category: 'free',
      access_type: 'both',
      monthly_payments: false
    });

    const user = await getUserById(created.id);
    console.log('Test subscriber created successfully. ID:', user.id);
    printDetails(user);
    process.exit(0);
  } catch (error) {
    console.error('Error creating test subscriber:', error.message);
    process.exit(1);
  }
}

function printDetails(user) {
  console.log('');
  console.log('Login:');
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
  console.log('');
  console.log('Access:');
  console.log(`  is_paying:         ${!!user.is_paying} (subscribed)`);
  console.log(`  payment_category:  ${user.payment_category} (no Stripe charge)`);
  console.log(`  monthly_payments:  ${!!user.monthly_payments}`);
  console.log(`  access_type:       ${user.access_type}`);
  console.log('');
  console.log(`RSS feed: ${BASE_URL}/rss/${user.rss_token}`);
}

createTestSubscriber();
