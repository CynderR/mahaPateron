import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminFeedPostShareButton from './AdminFeedPostShareButton';

interface AdminFeedShareActionProps {
  postId: string;
  isPublished?: boolean;
  shareToken?: string | null;
  className?: string;
}

const AdminFeedShareAction: React.FC<AdminFeedShareActionProps> = ({
  postId,
  isPublished = true,
  shareToken,
  className = ''
}) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;

  return (
    <AdminFeedPostShareButton
      postId={postId}
      shareToken={shareToken}
      isPublished={isPublished}
      className={className}
    />
  );
};

export default AdminFeedShareAction;
