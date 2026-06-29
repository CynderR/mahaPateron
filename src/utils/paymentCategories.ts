export const PAYMENT_CATEGORIES = ['full', 'free', 'discounted', 'non_card'] as const;

export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  full: 'Not Subscribed',
  free: 'free',
  discounted: 'discounted',
  non_card: 'non_card'
};
