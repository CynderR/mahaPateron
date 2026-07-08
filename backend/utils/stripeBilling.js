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
//   free / non-card → paying subscriber : enable monthly Stripe billing
//   paying subscriber → free / non-card : cancel subscription, stop billing
const applyStripeForPayingCategoryChange = async (user, nextCategory) => {
  const fromTier = payingTierFromCategory(user.payment_category);
  const toTier = payingTierFromCategory(nextCategory);

  const enteringPayingSubscriber =
    toTier === 'paying_subscriber' && (fromTier === 'free' || fromTier === 'non_card');
  const leavingPayingSubscriber =
    fromTier === 'paying_subscriber' && (toTier === 'free' || toTier === 'non_card');

  if (leavingPayingSubscriber) {
    await cancelStripeSubscriptionForUser(user);
    return { monthly_payments: 0, stripe_sub_id: null };
  }

  if (enteringPayingSubscriber) {
    return { monthly_payments: 1 };
  }

  return {};
};

module.exports = {
  stripe,
  cancelStripeSubscriptionForUser,
  applyStripeForPayingCategoryChange
};
