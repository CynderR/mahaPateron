const express = require('express');

const { BASE_URL } = require('../config');
const {
  getUserById,
  getUserByStripeCustomerId,
  getUserByStripeSubId,
  updateUserFields,
  activateUserSubscription,
  deactivateUserSubscription,
  getPlatformSettings
} = require('../database');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

const requireStripe = (req, res, next) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }
  next();
};

// Official Stripe Catalog Price for all paying subscribers.
// Prefer platform_settings.stripe_price_id; fall back to STRIPE_PRICE_ID env.
const resolveStripePriceId = async () => {
  const settings = await getPlatformSettings().catch(() => null);
  const fromSettings = settings && settings.stripe_price_id ? String(settings.stripe_price_id).trim() : '';
  const fromEnv = process.env.STRIPE_PRICE_ID ? String(process.env.STRIPE_PRICE_ID).trim() : '';
  return fromSettings || fromEnv || null;
};

const resolveDisplayPriceDollars = async (priceId) => {
  if (stripe && priceId) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (price && price.unit_amount != null) {
        return price.unit_amount / 100;
      }
    } catch (error) {
      console.warn('Could not load Stripe Price for display:', error.message);
    }
  }
  const settings = await getPlatformSettings().catch(() => null);
  return (settings && settings.default_price) || parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE) || 9.99;
};

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);
const AWAITING_PAYMENT_STATUSES = new Set(['incomplete', 'unpaid']);
const TERMINAL_SUB_STATUSES = new Set(['canceled', 'incomplete_expired']);

// Stripe Basil API (SDK v22+) puts the Payment Element secret on
// invoice.confirmation_secret; older APIs used invoice.payment_intent.
const SUBSCRIPTION_CLIENT_SECRET_EXPAND = [
  'latest_invoice.confirmation_secret',
  'latest_invoice.payment_intent'
];

const getSubscriptionClientSecret = (subscription) => {
  const invoice = subscription && subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return null;

  const confirmationSecret = invoice.confirmation_secret;
  if (
    confirmationSecret &&
    typeof confirmationSecret === 'object' &&
    confirmationSecret.client_secret
  ) {
    return confirmationSecret.client_secret;
  }

  const paymentIntent = invoice.payment_intent;
  if (paymentIntent && typeof paymentIntent === 'object' && paymentIntent.client_secret) {
    return paymentIntent.client_secret;
  }
  return null;
};

// If the user already has a usable Stripe subscription, reuse it instead of
// creating a second one. Returns a response payload, or null to create new.
const resolveExistingSubscription = async (user) => {
  if (!user.stripe_sub_id) return null;

  try {
    const existing = await stripe.subscriptions.retrieve(user.stripe_sub_id, {
      expand: SUBSCRIPTION_CLIENT_SECRET_EXPAND
    });

    if (ACTIVE_SUB_STATUSES.has(existing.status)) {
      return {
        alreadyActive: true,
        subscriptionId: existing.id,
        status: existing.status,
        clientSecret: null
      };
    }

    if (AWAITING_PAYMENT_STATUSES.has(existing.status)) {
      const clientSecret = getSubscriptionClientSecret(existing);
      if (clientSecret) {
        return {
          reused: true,
          subscriptionId: existing.id,
          status: existing.status,
          clientSecret
        };
      }
      // Incomplete/unpaid but no secret to confirm — cancel and recreate.
      try {
        await stripe.subscriptions.cancel(existing.id);
      } catch (cancelError) {
        console.warn('Could not cancel unusable incomplete subscription:', cancelError.message);
      }
      await updateUserFields(user.id, { stripe_sub_id: null });
      return null;
    }

    if (TERMINAL_SUB_STATUSES.has(existing.status)) {
      await updateUserFields(user.id, { stripe_sub_id: null });
      return null;
    }

    // past_due / paused / other non-terminal: do not create a duplicate.
    return {
      alreadyActive: true,
      subscriptionId: existing.id,
      status: existing.status,
      clientSecret: null
    };
  } catch (error) {
    if (error && error.code === 'resource_missing') {
      await updateUserFields(user.id, { stripe_sub_id: null });
      return null;
    }
    throw error;
  }
};

// GET /config — publishable key + catalog Price amount for the frontend.
router.get('/config', async (req, res) => {
  const priceId = await resolveStripePriceId();
  const defaultPrice = await resolveDisplayPriceDollars(priceId);
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    configured: !!stripe,
    defaultPrice,
    stripePriceConfigured: !!priceId
  });
});

// GET /subscription — current plan details pulled from Stripe.
router.get('/subscription', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.monthly_payments) {
      return res.json({
        monthly_payments: false,
        active: !!user.is_paying,
        is_paying: !!user.is_paying
      });
    }

    if (!stripe) {
      return res.json({
        monthly_payments: true,
        active: false,
        is_paying: !!user.is_paying
      });
    }

    if (!user.stripe_sub_id) {
      return res.json({ monthly_payments: true, active: false, is_paying: !!user.is_paying });
    }
    const sub = await stripe.subscriptions.retrieve(user.stripe_sub_id);
    const item = sub.items.data[0];
    res.json({
      monthly_payments: true,
      active: sub.status === 'active' || sub.status === 'trialing',
      status: sub.status,
      is_paying: !!user.is_paying,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      amount: item ? item.price.unit_amount / 100 : null,
      currency: item ? item.price.currency : 'usd'
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Could not load subscription' });
  }
});

// POST /create-subscription — create customer + subscription for the user.
// Reuses an existing active/incomplete Stripe subscription instead of creating
// a duplicate (guards double-clicks and abandoned checkouts).
router.post('/create-subscription', requireStripe, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.monthly_payments) {
      return res.status(403).json({ error: 'Monthly billing is not enabled for this account' });
    }

    const existingPayload = await resolveExistingSubscription(user);
    if (existingPayload) {
      return res.json(existingPayload);
    }

    // Re-read after possible stripe_sub_id clear above.
    const freshUser = await getUserById(user.id);
    let customerId = freshUser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: freshUser.email,
        name: freshUser.username,
        metadata: { app_user_id: String(freshUser.id) }
      });
      customerId = customer.id;
      await updateUserFields(freshUser.id, { stripe_customer_id: customerId });
    }

    const priceId = await resolveStripePriceId();
    if (!priceId) {
      return res.status(503).json({
        error:
          'Stripe Price is not configured. Set platform_settings.stripe_price_id or STRIPE_PRICE_ID to your Dashboard Price ID.'
      });
    }

    let subscription;
    try {
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: SUBSCRIPTION_CLIENT_SECRET_EXPAND
      });
    } catch (createError) {
      // Stale customer ID from a previous Stripe mode/account — recreate customer once.
      if (
        createError &&
        createError.code === 'resource_missing' &&
        String(createError.message || '').includes('No such customer')
      ) {
        const customer = await stripe.customers.create({
          email: freshUser.email,
          name: freshUser.username,
          metadata: { app_user_id: String(freshUser.id) }
        });
        customerId = customer.id;
        await updateUserFields(freshUser.id, {
          stripe_customer_id: customerId,
          stripe_sub_id: null
        });
        subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: SUBSCRIPTION_CLIENT_SECRET_EXPAND
        });
      } else {
        throw createError;
      }
    }

    await updateUserFields(freshUser.id, { stripe_sub_id: subscription.id });

    const clientSecret = getSubscriptionClientSecret(subscription);
    if (!clientSecret) {
      return res.status(500).json({
        error:
          'Subscription was created but no payment secret was returned. Check Stripe API version / invoice confirmation_secret.'
      });
    }

    res.json({
      subscriptionId: subscription.id,
      clientSecret
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: error.message || 'Could not create subscription' });
  }
});

// POST /create-portal-session — Stripe Customer Portal for payment methods.
router.post('/create-portal-session', requireStripe, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user || !user.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer for this account' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${BASE_URL}/account/billing`
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ error: 'Could not open billing portal' });
  }
});

// POST /cancel — cancel the subscription and mark Payment → Not subscribed.
router.post('/cancel', requireStripe, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user || !user.stripe_sub_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }
    await stripe.subscriptions.cancel(user.stripe_sub_id);
    await deactivateUserSubscription(user.id);
    // Clear sub id so a later Subscribe creates exactly one new subscription
    // (keep stripe_customer_id so the Customer Portal still works).
    await updateUserFields(user.id, { stripe_sub_id: null });
    res.json({ message: 'Subscription cancelled' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Could not cancel subscription' });
  }
});

// Webhook handler — mounted separately in server.js with express.raw so the
// signature can be verified against the unparsed request body.
const webhookHandler = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    const settings = await getPlatformSettings().catch(() => null);
    webhookSecret = settings && settings.stripe_webhook_secret;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const user = await getUserByStripeCustomerId(invoice.customer);
        // Stripe only drives Payment for paying subscribers (not free / non-card).
        if (user && user.monthly_payments) {
          await activateUserSubscription(user.id);
          if (invoice.subscription) {
            await updateUserFields(user.id, { stripe_sub_id: invoice.subscription });
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const user = await getUserByStripeCustomerId(invoice.customer);
        if (user && user.monthly_payments) {
          await deactivateUserSubscription(user.id);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const user =
          (await getUserByStripeSubId(subscription.id)) ||
          (await getUserByStripeCustomerId(subscription.customer));
        if (user && user.monthly_payments) {
          await deactivateUserSubscription(user.id);
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports = { router, webhookHandler };
