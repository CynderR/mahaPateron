const express = require('express');

const { BASE_URL } = require('../config');
const {
  getUserById,
  getUserByStripeCustomerId,
  getUserByStripeSubId,
  updateUserFields,
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

// Resolve the monthly amount (in cents) for a user: their override price, else
// the platform default.
const resolveAmountCents = async (user) => {
  let price = user.subscription_price;
  if (price === null || price === undefined) {
    const settings = await getPlatformSettings();
    price = (settings && settings.default_price) || parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE) || 9.99;
  }
  return Math.round(parseFloat(price) * 100);
};

// GET /config — publishable key + default price for the frontend.
router.get('/config', async (req, res) => {
  const settings = await getPlatformSettings().catch(() => null);
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    configured: !!stripe,
    defaultPrice: (settings && settings.default_price) || parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE) || 9.99
  });
});

// GET /subscription — current plan details pulled from Stripe.
router.get('/subscription', requireStripe, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user || !user.stripe_sub_id) {
      return res.json({ active: false, is_paying: !!(user && user.is_paying) });
    }
    const sub = await stripe.subscriptions.retrieve(user.stripe_sub_id);
    const item = sub.items.data[0];
    res.json({
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
router.post('/create-subscription', requireStripe, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: { app_user_id: String(user.id) }
      });
      customerId = customer.id;
      await updateUserFields(user.id, { stripe_customer_id: customerId });
    }

    const amount = await resolveAmountCents(user);

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shyam Akaash Membership' },
            recurring: { interval: 'month' },
            unit_amount: amount
          }
        }
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });

    await updateUserFields(user.id, { stripe_sub_id: subscription.id });

    const paymentIntent = subscription.latest_invoice && subscription.latest_invoice.payment_intent;
    res.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent ? paymentIntent.client_secret : null
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

// POST /cancel — cancel the subscription and mark the user non-paying.
router.post('/cancel', requireStripe, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user || !user.stripe_sub_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }
    await stripe.subscriptions.cancel(user.stripe_sub_id);
    await updateUserFields(user.id, { is_paying: 0 });
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
        if (user) {
          const fields = { is_paying: 1 };
          if (invoice.subscription) fields.stripe_sub_id = invoice.subscription;
          await updateUserFields(user.id, fields);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const user = await getUserByStripeCustomerId(invoice.customer);
        if (user) await updateUserFields(user.id, { is_paying: 0 });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const user =
          (await getUserByStripeSubId(subscription.id)) ||
          (await getUserByStripeCustomerId(subscription.customer));
        if (user) await updateUserFields(user.id, { is_paying: 0 });
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
