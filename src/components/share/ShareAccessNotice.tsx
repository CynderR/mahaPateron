import React from 'react';
import { buildSignInUrl } from '../../config';

interface ShareAccessNoticeProps {
  memberAccess: boolean;
  memberMessage: string;
  className?: string;
  style?: React.CSSProperties;
}

const ShareAccessNotice: React.FC<ShareAccessNoticeProps> = ({
  memberAccess,
  memberMessage,
  className = 'pod-banner pod-banner-info',
  style
}) => {
  const signInUrl = buildSignInUrl();

  if (memberAccess) {
    return (
      <p className={className} style={style}>
        {memberMessage}
      </p>
    );
  }

  return (
    <p className="share-access-notice pod-banner" style={style}>
      This link includes the shared episode only.{' '}
      <a href={signInUrl} className="share-access-notice-link">
        Sign in
      </a>{' '}
      to your account for full access.
    </p>
  );
};

export default ShareAccessNotice;
