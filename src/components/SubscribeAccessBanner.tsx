import React from 'react';
import { Link } from 'react-router-dom';

interface SubscribeAccessBannerProps {
  className?: string;
}

/** Banner for non-subscribed users prompting them to subscribe. */
const SubscribeAccessBanner: React.FC<SubscribeAccessBannerProps> = ({ className = '' }) => (
  <div className={`pod-banner pod-banner-subscribe ${className}`.trim()}>
    <Link to="/account/billing" className="pod-banner-subscribe-link">
      Subscribe
    </Link>{' '}
    for full access.
  </div>
);

export default SubscribeAccessBanner;
