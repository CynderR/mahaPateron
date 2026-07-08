const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// Cancel the user's Stripe subscription if one exists. Used on self-delete and
// admin delete so Stripe stops charging deleted accounts.
const cancelStripeSubscriptionForUser = async (user) => {
  if (!stripe || !user || !user.stripe_sub_id) {
    return { cancelled: false };
  }
  try {
    await stripe.subscriptions.cancel(user.stripe_sub_id);
    return { cancelled: true };
  } catch (error) {
    console.warn('Stripe cancel during account deletion failed:', error.message);
    return { cancelled: false, error: error.message };
  }
};

module.exports = {
  stripe,
  cancelStripeSubscriptionForUser
};
