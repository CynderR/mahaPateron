const { payingTierFromCategory } = require('./paymentCategories');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// Cancel the user's Stripe subscription if one exists. Used on self-delete,
// admin delete, and when admin moves a user off paying subscriber.
const cancelStripeSubscriptionForUser = async (user) => {
  if (!stripe || !user || !user.stripe_sub_id) {
    return { cancelled: false };
  }
  try {
    await stripe.subscriptions.cancel(user.stripe_sub_id);
    return { cancelled: true };
  } catch (error) {
    console.warn('Stripe cancel failed:', error.message);
    return { cancelled: false, error: error.message };
  }
};

// Apply Stripe-side effects when admin changes the paying tier (payment_category).
// Only these transitions touch Stripe; all others are ignored.
//   free → paying subscriber : enable monthly Stripe (access now — existing rule)
//   non-card → paying subscriber : enable Stripe eligibility only; access after checkout
//   paying subscriber → free / non-card : cancel subscription, stop billing
const applyStripeForPayingCategoryChange = async (user, nextCategory) => {
  const fromTier = payingTierFromCategory(user.payment_category);
  const toTier = payingTierFromCategory(nextCategory);

  const leavingPayingSubscriber =
    fromTier === 'paying_subscriber' && (toTier === 'free' || toTier === 'non_card');

  if (leavingPayingSubscriber) {
    await cancelStripeSubscriptionForUser(user);
    return { monthly_payments: 0, stripe_sub_id: null };
  }

  // Option B: non-card → paying subscriber is eligible to pay, not yet subscribed.
  if (fromTier === 'non_card' && toTier === 'paying_subscriber') {
    return { monthly_payments: 1, is_paying: 0 };
  }

  // free → paying subscriber: keep access now; enable monthly Stripe billing.
  if (fromTier === 'free' && toTier === 'paying_subscriber') {
    return { monthly_payments: 1 };
  }

  return {};
};

module.exports = {
  stripe,
  cancelStripeSubscriptionForUser,
  applyStripeForPayingCategoryChange
};
