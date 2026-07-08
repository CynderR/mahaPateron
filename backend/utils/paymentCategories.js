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

module.exports = {
  NOT_SUBSCRIBED_CATEGORY,
  FREE_CATEGORY,
  NON_CARD_CATEGORY,
  PAYING_SUBSCRIBER_CATEGORY,
  normalizePaymentCategory,
  payingTierFromCategory,
  isSubscribedCategory
};
