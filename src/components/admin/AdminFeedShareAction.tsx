import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminFeedPostShareButton from './AdminFeedPostShareButton';
import AdminPostEditButton from './AdminPostEditButton';

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
    <div className={`admin-feed-post-actions ${className}`.trim()}>
      <AdminPostEditButton postId={postId} postTitle={postTitle} />
      <AdminFeedPostShareButton
        postId={postId}
        postTitle={postTitle}
        shareToken={shareToken}
        isPublished={isPublished}
        className="admin-feed-share"
      />
    </div>
  );
};

export default AdminFeedShareAction;
