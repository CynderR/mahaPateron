import React from 'react';
import {
  PayingTier,
  PAYING_TIER_OPTIONS,
  payingTierFromCategory
} from '../../utils/paymentCategories';

interface PayingTierSelectProps {
  paymentCategory: string;
  /** When false with paying_subscriber, still show the tier (pending Stripe checkout). */
  isPaying?: boolean | number | null;
  onChange: (tier: PayingTier) => void;
  disabled?: boolean;
  className?: string;
}

const PayingTierSelect: React.FC<PayingTierSelectProps> = ({
  paymentCategory,
  isPaying,
  onChange,
  disabled = false,
  className = 'pod-select'
}) => {
  const tier = payingTierFromCategory(paymentCategory);
  const subscribed = tier !== '';
  const pendingCheckout =
    tier === 'paying_subscriber' && !(isPaying === true || isPaying === 1);

  return (
    <select
      className={className}
      value={tier}
      disabled={disabled || !subscribed}
      title={
        pendingCheckout
          ? 'Paying subscriber — access unlocks after Stripe checkout'
          : subscribed
            ? 'Subscriber payment tier'
            : 'Set Payment to Subscribed to choose a paying tier'
      }
      onChange={(e) => onChange(e.target.value as PayingTier)}
    >
      {!subscribed && <option value="">—</option>}
      {PAYING_TIER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default PayingTierSelect;
