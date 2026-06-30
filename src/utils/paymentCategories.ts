export const PAYMENT_CATEGORIES = ['full', 'free', 'discounted', 'non_card'] as const;

export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full' as const;
export const DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY = 'discounted' as const;

export type SubscriptionStatus = 'not_subscribed' | 'subscribed';

export const SUBSCRIPTION_STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: 'not_subscribed', label: 'Not subscribed' },
  { value: 'subscribed', label: 'Subscribed' }
];

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  full: 'Not subscribed',
  free: 'free',
  discounted: 'discounted',
  non_card: 'non_card'
};

export const subscriptionStatusFromCategory = (paymentCategory: string): SubscriptionStatus =>
  paymentCategory === NOT_SUBSCRIBED_PAYMENT_CATEGORY ? 'not_subscribed' : 'subscribed';

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
