import React from 'react';
import {
  PayingTier,
  PAYING_TIER_OPTIONS,
  payingTierFromCategory
} from '../../utils/paymentCategories';

interface PayingTierSelectProps {
  paymentCategory: string;
  onChange: (tier: PayingTier) => void;
  disabled?: boolean;
  className?: string;
}

const PayingTierSelect: React.FC<PayingTierSelectProps> = ({
  paymentCategory,
  onChange,
  disabled = false,
  className = 'pod-select'
}) => {
  const tier = payingTierFromCategory(paymentCategory);
  const subscribed = tier !== '';

  return (
    <select
      className={className}
      value={tier}
      disabled={disabled || !subscribed}
      title={
        subscribed
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
