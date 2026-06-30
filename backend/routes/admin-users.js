const express = require('express');
const bcrypt = require('bcryptjs');

const {
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  getUsersFiltered,
  updateUserFields,
  activateUserSubscription,
  softDeleteUser
} = require('../database');
const { ACCESS_TYPES } = require('../utils/accessPermissions');

const router = express.Router();

const PAYMENT_CATEGORIES = ['full', 'free', 'discounted', 'non_card'];

const sanitizeUser = (user) => {
  if (!user) return user;
  const { password, password_reset_token, password_reset_expires, ...rest } = user;
  return rest;
};

// GET / — paginated list with filters.
router.get('/', async (req, res) => {
  try {
    const { page, limit, is_paying, payment_category, subscription_status, access_type, is_admin } = req.query;
    const result = await getUsersFiltered({
      page,
      limit,
      is_paying,
      payment_category,
      subscription_status,
      access_type,
      is_admin
    });
    res.json(result);
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create a user; rss_token is generated automatically in createUser.
router.post('/', async (req, res) => {
  try {
    const {
      username, email, password, whatsapp_id, signal_id,
      payment_category, access_type, subscription_price, is_admin, is_paying,
      back_catalog_access, monthly_payments
    } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }
    if (payment_category && !PAYMENT_CATEGORIES.includes(payment_category)) {
      return res.status(400).json({ error: 'Invalid payment_category' });
    }
    if (access_type && !ACCESS_TYPES.includes(access_type)) {
      return res.status(400).json({ error: 'Invalid access_type' });
    }

    if (await getUserByEmail(email)) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    if (await getUserByUsername(username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Admin-created accounts get a random password they can reset via the
    // forgot-password flow if none is provided.
    const rawPassword = password || require('crypto').randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newUser = await createUser({
      username,
      email,
      password: hashedPassword,
      whatsapp_id: whatsapp_id || null,
      signal_id: signal_id || null,
      payment_category: payment_category || 'full',
      access_type: access_type || 'streaming',
      subscription_price: subscription_price !== undefined && subscription_price !== '' ? parseFloat(subscription_price) : null,
      is_admin: !!is_admin,
      is_paying: !!is_paying,
      back_catalog_access: !!back_catalog_access,
      monthly_payments: monthly_payments !== false && monthly_payments !== 0 && monthly_payments !== 'false'
    });

    const created = await getUserById(newUser.id);
    res.status(201).json({ message: 'User created', user: sanitizeUser(created) });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update any user field.
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (data.payment_category && !PAYMENT_CATEGORIES.includes(data.payment_category)) {
      return res.status(400).json({ error: 'Invalid payment_category' });
    }
    if (data.access_type && !ACCESS_TYPES.includes(data.access_type)) {
      return res.status(400).json({ error: 'Invalid access_type' });
    }

    if (data.username) {
      const existing = await getUserByUsername(data.username);
      if (existing && existing.id !== parseInt(id, 10)) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }
    if (data.email) {
      const existing = await getUserByEmail(data.email);
      if (existing && existing.id !== parseInt(id, 10)) {
        return res.status(400).json({ error: 'Email already taken' });
      }
    }

    // Normalize booleans/numbers that arrive as strings from the admin UI.
    if (data.is_paying !== undefined) data.is_paying = data.is_paying ? 1 : 0;
    if (data.is_admin !== undefined) data.is_admin = data.is_admin ? 1 : 0;
    if (data.is_free !== undefined) data.is_free = data.is_free ? 1 : 0;
    if (data.back_catalog_access !== undefined) {
      data.back_catalog_access = data.back_catalog_access ? 1 : 0;
    }
    if (data.monthly_payments !== undefined) {
      data.monthly_payments = data.monthly_payments ? 1 : 0;
    }
    if (data.subscription_price === '' || data.subscription_price === null) {
      data.subscription_price = null;
    } else if (data.subscription_price !== undefined) {
      data.subscription_price = parseFloat(data.subscription_price);
    }

    // Never allow a password or raw rss_token rewrite through this endpoint.
    delete data.password;
    delete data.rss_token;
    delete data.deleted_at;
    delete data.subscribed_at;

    const existing = await getUserById(id);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const activating =
      data.is_paying === 1 && !existing.is_paying;

    await updateUserFields(id, data);
    if (activating) {
      await activateUserSubscription(id);
    }
    const updated = await getUserById(id);
    res.json({ message: 'User updated', user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — soft delete and invalidate the RSS feed.
router.delete('/:id', async (req, res) => {
  try {
    const result = await softDeleteUser(req.params.id);
    if (result.deleted) {
      res.json({ message: 'User deleted' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
