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

  return (
    <p className={className} style={style}>
      {memberAccess ? (
        memberMessage
      ) : (
        <>
          This link includes the shared episode only. Sign in to your account for full access.{' '}
          <a href={signInUrl}>{signInUrl}</a>
        </>
      )}
    </p>
  );
};

export default ShareAccessNotice;
