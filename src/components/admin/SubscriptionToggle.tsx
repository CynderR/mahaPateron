import React from 'react';
import { SubscriptionStatus, subscriptionStatusLabel } from '../../utils/paymentCategories';

interface SubscriptionToggleProps {
  value: SubscriptionStatus;
  onChange: (status: SubscriptionStatus) => void;
  disabled?: boolean;
}

const SubscriptionToggle: React.FC<SubscriptionToggleProps> = ({ value, onChange, disabled = false }) => {
  const subscribed = value === 'subscribed';

  return (
    <label
      className="pod-subscription-toggle"
      title="Subscription status — admin control; payment platform can update later"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: disabled ? 'default' : 'pointer' }}
    >
      <input
        type="checkbox"
        checked={subscribed}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked ? 'subscribed' : 'not_subscribed')}
      />
      <span>{subscriptionStatusLabel(value)}</span>
    </label>
  );
};

export default SubscriptionToggle;
