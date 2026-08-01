const NOT_SUBSCRIBED_CATEGORY = 'full';
const FREE_CATEGORY = 'free';
const NON_CARD_CATEGORY = 'non_card';
const PAYING_SUBSCRIBER_CATEGORY = 'paying_subscriber';
const LEGACY_PAYING_SUBSCRIBER_CATEGORY = 'discounted';

const normalizePaymentCategory = (category) => {
  if (category === LEGACY_PAYING_SUBSCRIBER_CATEGORY) return PAYING_SUBSCRIBER_CATEGORY;
  return category || NOT_SUBSCRIBED_CATEGORY;
};

const payingTierFromCategory = (category) => {
  const normalized = normalizePaymentCategory(category);
  if (normalized === FREE_CATEGORY) return 'free';
  if (normalized === NON_CARD_CATEGORY) return 'non_card';
  if (normalized === PAYING_SUBSCRIBER_CATEGORY) return 'paying_subscriber';
  return '';
};

const isSubscribedCategory = (category) =>
  payingTierFromCategory(category) !== '';

/**
 * Same rules as admin Payment toggle (SubscriptionToggle / subscriptionStatusFromUser):
 * - paying_subscriber without is_paying → Not Subscribed
 * - payment_category full → Not Subscribed
 * - otherwise → Subscribed
 */
const subscriptionStatusFromUser = (paymentCategory, isPaying) => {
  const paying = isPaying === true || isPaying === 1 || isPaying === '1';
  const category = normalizePaymentCategory(paymentCategory);
  if (category === PAYING_SUBSCRIBER_CATEGORY && !paying) {
    return 'not_subscribed';
  }
  return category === NOT_SUBSCRIBED_CATEGORY ? 'not_subscribed' : 'subscribed';
};

const userPaymentIsSubscribed = (user) => {
  if (!user) return false;
  return subscriptionStatusFromUser(user.payment_category, user.is_paying) === 'subscribed';
};

module.exports = {
  NOT_SUBSCRIBED_CATEGORY,
  FREE_CATEGORY,
  NON_CARD_CATEGORY,
  PAYING_SUBSCRIBER_CATEGORY,
  normalizePaymentCategory,
  payingTierFromCategory,
  isSubscribedCategory,
  subscriptionStatusFromUser,
  userPaymentIsSubscribed
};
