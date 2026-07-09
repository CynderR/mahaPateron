export const PAYMENT_CATEGORIES = ['full', 'free', 'paying_subscriber', 'non_card'] as const;

export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full' as const;
export const PAYING_SUBSCRIBER_PAYMENT_CATEGORY = 'paying_subscriber' as const;
export const DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY = PAYING_SUBSCRIBER_PAYMENT_CATEGORY;

export type SubscriptionStatus = 'not_subscribed' | 'subscribed';

export const SUBSCRIPTION_STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: 'not_subscribed', label: 'Not Subscribed' },
  { value: 'subscribed', label: 'Subscribed' }
];

export const subscriptionStatusLabel = (status: SubscriptionStatus): string =>
  SUBSCRIPTION_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Not Subscribed';

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  full: 'Not Subscribed',
  free: 'Free',
  paying_subscriber: 'Paying subscriber',
  non_card: 'Non-card'
};

export const SUBSCRIBED_PAYMENT_CATEGORIES = ['free', 'paying_subscriber', 'non_card'] as const;

export type PayingTier = 'free' | 'non_card' | 'paying_subscriber';

export const PAYING_TIER_OPTIONS: { value: PayingTier; label: string; payment_category: PaymentCategory }[] = [
  { value: 'free', label: 'free', payment_category: 'free' },
  { value: 'non_card', label: 'non-card', payment_category: 'non_card' },
  { value: 'paying_subscriber', label: 'paying subscriber', payment_category: 'paying_subscriber' }
];

export const payingTierFromCategory = (paymentCategory: string): PayingTier | '' => {
  const match = PAYING_TIER_OPTIONS.find((option) => option.payment_category === paymentCategory);
  return match?.value ?? '';
};

export const payingTierLabel = (tier: PayingTier): string =>
  PAYING_TIER_OPTIONS.find((option) => option.value === tier)?.label ?? tier;

export const fieldsFromPayingTier = (
  tier: PayingTier
): { payment_category: PaymentCategory; is_paying: boolean; monthly_payments: boolean } => {
  const option = PAYING_TIER_OPTIONS.find((o) => o.value === tier);
  if (!option) {
    return {
      payment_category: DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY,
      is_paying: true,
      monthly_payments: true
    };
  }
  return {
    payment_category: option.payment_category,
    is_paying: true,
    monthly_payments: tier === 'paying_subscriber'
  };
};

export const subscriptionStatusFromCategory = (paymentCategory: string): SubscriptionStatus =>
  paymentCategory === NOT_SUBSCRIBED_PAYMENT_CATEGORY ? 'not_subscribed' : 'subscribed';

const normalizePaymentCategory = (category: string): PaymentCategory | string =>
  category === 'discounted' ? PAYING_SUBSCRIBER_PAYMENT_CATEGORY : category;

/** Payment tab status including pending Stripe checkout (paying_subscriber, not yet paid). */
export const subscriptionStatusFromUser = (
  paymentCategory: string,
  isPaying?: boolean | number | null
): SubscriptionStatus => {
  const paying = isPaying === true || isPaying === 1;
  if (normalizePaymentCategory(paymentCategory) === PAYING_SUBSCRIBER_PAYMENT_CATEGORY && !paying) {
    return 'not_subscribed';
  }
  return subscriptionStatusFromCategory(paymentCategory);
};

export const paymentCategoryHasShareFullAccess = (paymentCategory: string): boolean =>
  paymentCategory !== NOT_SUBSCRIBED_PAYMENT_CATEGORY;

export const subscriptionFieldsFromStatus = (
  status: SubscriptionStatus,
  currentCategory: string
): { payment_category: PaymentCategory; is_paying: boolean; monthly_payments?: boolean } => {
  const normalizedCategory = normalizePaymentCategory(currentCategory);

  if (status === 'not_subscribed') {
    return { payment_category: NOT_SUBSCRIBED_PAYMENT_CATEGORY, is_paying: false };
  }

  // Free comps stay subscribed with no Stripe billing.
  if (normalizedCategory === 'free') {
    return {
      payment_category: 'free',
      is_paying: true,
      monthly_payments: false
    };
  }

  if (normalizedCategory === 'non_card') {
    return {
      payment_category: 'non_card',
      is_paying: true,
      monthly_payments: false
    };
  }

  if (normalizedCategory === 'paying_subscriber') {
    return {
      payment_category: 'paying_subscriber',
      is_paying: true,
      monthly_payments: true
    };
  }

  return {
    payment_category:
      normalizedCategory === NOT_SUBSCRIBED_PAYMENT_CATEGORY
        ? DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY
        : (normalizedCategory as PaymentCategory),
    is_paying: true
  };
};
