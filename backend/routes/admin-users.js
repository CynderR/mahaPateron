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
  softDeleteUser,
  restoreUser,
  purgeDeletedUserByEmail,
  permanentlyDeleteUser
} = require('../database');
const { ACCESS_TYPES } = require('../utils/accessPermissions');
const { validatePassword } = require('../utils/passwordPolicy');
const {
  cancelStripeSubscriptionForUser,
  applyStripeForPayingCategoryChange
} = require('../utils/stripeBilling');
const {
  FREE_CATEGORY,
  NON_CARD_CATEGORY,
  PAYING_SUBSCRIBER_CATEGORY,
  NOT_SUBSCRIBED_CATEGORY,
  normalizePaymentCategory,
  isSubscribedCategory
} = require('../utils/paymentCategories');

const router = express.Router();

const PAYMENT_CATEGORIES = ['full', 'free', 'paying_subscriber', 'non_card'];

const sanitizeUser = (user) => {
  if (!user) return user;
  const { password, password_reset_token, password_reset_expires, ...rest } = user;
  return rest;
};

// Free subscribers always show Payment → Subscribed and skip Stripe billing.
const applyFreeSubscriberRules = (data) => {
  if (data.payment_category !== FREE_CATEGORY) return data;
  return {
    ...data,
    is_paying: 1,
    monthly_payments: 0
  };
};

// Non-card subscribers are subscribed but never billed through Stripe.
const applyNonCardSubscriberRules = (data) => {
  if (data.payment_category !== NON_CARD_CATEGORY) return data;
  return {
    ...data,
    is_paying: 1,
    monthly_payments: 0
  };
};

// Paying subscribers are eligible for Stripe monthly billing.
// pendingCheckout: keep Payment Not-active until Stripe checkout succeeds
// (used for admin non-card → paying subscriber = Option B).
const applyPayingSubscriberRules = (data, { pendingCheckout = false } = {}) => {
  if (data.payment_category !== PAYING_SUBSCRIBER_CATEGORY) return data;
  return {
    ...data,
    is_paying: pendingCheckout ? 0 : 1,
    monthly_payments: data.monthly_payments !== undefined ? data.monthly_payments : 1
  };
};

const applySubscribedCategoryRules = (data, options = {}) => {
  const category = normalizePaymentCategory(data.payment_category);
  if (category === FREE_CATEGORY) return applyFreeSubscriberRules({ ...data, payment_category: FREE_CATEGORY });
  if (category === NON_CARD_CATEGORY) {
    return applyNonCardSubscriberRules({ ...data, payment_category: NON_CARD_CATEGORY });
  }
  if (category === PAYING_SUBSCRIBER_CATEGORY) {
    return applyPayingSubscriberRules({ ...data, payment_category: PAYING_SUBSCRIBER_CATEGORY }, options);
  }
  return data;
};

// GET / — paginated list with filters.
router.get('/', async (req, res) => {
  try {
    const {
      page,
      limit,
      is_paying,
      payment_category,
      subscription_status,
      access_type,
      is_admin,
      q,
      account_status
    } = req.query;
    const result = await getUsersFiltered({
      page,
      limit,
      is_paying,
      payment_category,
      subscription_status,
      access_type,
      is_admin,
      q,
      account_status
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
      back_catalog_access, monthly_payments, download_access
    } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    if (payment_category && !PAYMENT_CATEGORIES.includes(payment_category)) {
      return res.status(400).json({ error: 'Invalid payment_category' });
    }
    if (access_type && !ACCESS_TYPES.includes(access_type)) {
      return res.status(400).json({ error: 'Invalid access_type' });
    }

    const existingEmailUser = await getUserByEmail(email);
    if (existingEmailUser) {
      if (!existingEmailUser.deleted_at) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      await purgeDeletedUserByEmail(email);
    }
    if (await getUserByUsername(username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const freeFields = applySubscribedCategoryRules({
      payment_category: payment_category || 'full',
      is_paying: !!is_paying,
      monthly_payments: monthly_payments !== false && monthly_payments !== 0 && monthly_payments !== 'false'
    });

    const newUser = await createUser({
      username,
      email,
      password: hashedPassword,
      whatsapp_id: whatsapp_id || null,
      signal_id: signal_id || null,
      payment_category: freeFields.payment_category,
      access_type: access_type || 'streaming',
      subscription_price: subscription_price !== undefined && subscription_price !== '' ? parseFloat(subscription_price) : null,
      is_admin: !!is_admin,
      is_paying: !!freeFields.is_paying,
      back_catalog_access: !!back_catalog_access,
      monthly_payments: freeFields.monthly_payments,
      download_access: !!download_access
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
    let data = { ...req.body };

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
    if (data.download_access !== undefined) {
      data.download_access = data.download_access ? 1 : 0;
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

    const nextCategory = data.payment_category !== undefined
      ? normalizePaymentCategory(data.payment_category)
      : normalizePaymentCategory(existing.payment_category);

    if (data.payment_category !== undefined) {
      data.payment_category = nextCategory;
    }

    const previousCategory = normalizePaymentCategory(existing.payment_category);
    const categoryChanged =
      data.payment_category !== undefined && nextCategory !== previousCategory;
    // Admin non-card → paying subscriber: Stripe-eligible only; access after checkout.
    const pendingCheckoutFromNonCard =
      categoryChanged &&
      previousCategory === NON_CARD_CATEGORY &&
      nextCategory === PAYING_SUBSCRIBER_CATEGORY;

    if (categoryChanged) {
      const stripeUpdates = await applyStripeForPayingCategoryChange(existing, nextCategory);
      data = { ...data, ...stripeUpdates };
    }

    if (isSubscribedCategory(nextCategory)) {
      data = applySubscribedCategoryRules(
        { ...data, payment_category: nextCategory },
        { pendingCheckout: pendingCheckoutFromNonCard }
      );
    }

    const activating =
      data.is_paying === 1 && !existing.is_paying;
    const deactivating =
      (data.is_paying === 0 && !!existing.is_paying) ||
      (nextCategory === NOT_SUBSCRIBED_CATEGORY && previousCategory !== NOT_SUBSCRIBED_CATEGORY);

    if (deactivating) {
      data.unsubscribed_at = new Date().toISOString();
    } else if (activating) {
      data.unsubscribed_at = null;
    }

    await updateUserFields(id, data);
    // Do not activate on non-card → paying_subscriber; webhook activates after payment.
    if (activating && nextCategory === PAYING_SUBSCRIBER_CATEGORY && !pendingCheckoutFromNonCard) {
      await activateUserSubscription(id);
    } else if (activating && nextCategory === FREE_CATEGORY) {
      await updateUserFields(id, { subscribed_at: new Date().toISOString() });
    } else if (activating && nextCategory === NON_CARD_CATEGORY) {
      await updateUserFields(id, { subscribed_at: new Date().toISOString() });
    }
    const updated = await getUserById(id);
    res.json({ message: 'User updated', user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/restore — restore a soft-deleted user record.
router.post('/:id/restore', async (req, res) => {
  try {
    const result = await restoreUser(req.params.id);
    if (!result.restored) {
      return res.status(404).json({ error: 'Deleted user not found' });
    }

    const restored = await getUserById(req.params.id);
    res.json({ message: 'User restored', user: sanitizeUser(restored) });
  } catch (error) {
    console.error('Admin restore user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — cancel Stripe billing (if any), then soft or permanent delete.
router.delete('/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await cancelStripeSubscriptionForUser(user);
    if (user.stripe_sub_id) {
      await updateUserFields(user.id, {
        is_paying: 0,
        stripe_sub_id: null
      });
    }

    const mode = req.body?.mode === 'permanent' ? 'permanent' : 'reuse_email';
    const result =
      mode === 'permanent'
        ? await permanentlyDeleteUser(req.params.id)
        : await softDeleteUser(req.params.id);

    if (result.deleted) {
      res.json({
        message: mode === 'permanent' ? 'User permanently deleted' : 'User deleted and email cleared'
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
