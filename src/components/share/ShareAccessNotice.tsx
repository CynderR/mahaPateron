import React from 'react';
import { Link } from 'react-router-dom';

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
}) => (
  <p className={className} style={style}>
    {memberAccess ? (
      memberMessage
    ) : (
      <>
        This link includes the shared episode only. <Link to="/signin">Sign in</Link> to your account for full
        access.
      </>
    )}
  </p>
);

export default ShareAccessNotice;
