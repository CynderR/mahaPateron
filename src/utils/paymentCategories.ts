export const PAYMENT_CATEGORIES = ['full', 'free', 'discounted', 'non_card'] as const;

export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full' as const;
export const DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY = 'discounted' as const;

export type SubscriptionStatus = 'not_subscribed' | 'subscribed';

export const SUBSCRIPTION_STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: 'not_subscribed', label: 'Not Subscribed' },
  { value: 'subscribed', label: 'Subscribed' }
];

export const subscriptionStatusLabel = (status: SubscriptionStatus): string =>
  SUBSCRIPTION_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Not Subscribed';

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  full: 'Not Subscribed',
  free: 'free',
  discounted: 'discounted',
  non_card: 'non_card'
};

export const SUBSCRIBED_PAYMENT_CATEGORIES = ['free', 'discounted', 'non_card'] as const;

export type PayingTier = 'free' | 'non_card' | 'paying_subscriber';

export const PAYING_TIER_OPTIONS: { value: PayingTier; label: string; payment_category: PaymentCategory }[] = [
  { value: 'free', label: 'free', payment_category: 'free' },
  { value: 'non_card', label: 'non-card', payment_category: 'non_card' },
  { value: 'paying_subscriber', label: 'paying subscriber', payment_category: 'discounted' }
];

export const payingTierFromCategory = (paymentCategory: string): PayingTier | '' => {
  const match = PAYING_TIER_OPTIONS.find((option) => option.payment_category === paymentCategory);
  return match?.value ?? '';
};

export const payingTierLabel = (tier: PayingTier): string =>
  PAYING_TIER_OPTIONS.find((option) => option.value === tier)?.label ?? tier;

export const fieldsFromPayingTier = (
  tier: PayingTier
): { payment_category: PaymentCategory; is_paying: boolean } => {
  const option = PAYING_TIER_OPTIONS.find((o) => o.value === tier);
  if (!option) {
    return { payment_category: DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY, is_paying: true };
  }
  return { payment_category: option.payment_category, is_paying: true };
};

export const subscriptionStatusFromCategory = (paymentCategory: string): SubscriptionStatus =>
  paymentCategory === NOT_SUBSCRIBED_PAYMENT_CATEGORY ? 'not_subscribed' : 'subscribed';

export const paymentCategoryHasShareFullAccess = (paymentCategory: string): boolean =>
  paymentCategory !== NOT_SUBSCRIBED_PAYMENT_CATEGORY;

export const subscriptionFieldsFromStatus = (
  status: SubscriptionStatus,
  currentCategory: string
): { payment_category: PaymentCategory; is_paying: boolean } => {
  if (status === 'not_subscribed') {
    return { payment_category: NOT_SUBSCRIBED_PAYMENT_CATEGORY, is_paying: false };
  }

  return {
    payment_category:
      currentCategory === NOT_SUBSCRIBED_PAYMENT_CATEGORY
        ? DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY
        : (currentCategory as PaymentCategory),
    is_paying: true
  };
};
