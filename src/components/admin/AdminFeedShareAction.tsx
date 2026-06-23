import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminFeedPostShareButton from './AdminFeedPostShareButton';

interface AdminFeedShareActionProps {
  postId: string;
  postTitle: string;
  isPublished?: boolean;
  shareToken?: string | null;
  className?: string;
}

const AdminFeedShareAction: React.FC<AdminFeedShareActionProps> = ({
  postId,
  postTitle,
  isPublished = true,
  shareToken,
  className = ''
}) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;

  return (
    <AdminFeedPostShareButton
      postId={postId}
      postTitle={postTitle}
      shareToken={shareToken}
      isPublished={isPublished}
      className={className}
    />
  );
};

export default AdminFeedShareAction;
