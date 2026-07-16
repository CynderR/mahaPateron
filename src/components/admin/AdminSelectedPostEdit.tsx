import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { normalizePostId } from '../../utils/episodeListHelpers';
import AdminPostEditButton from './AdminPostEditButton';

interface AdminSelectedPostEditProps {
  postIds: string[];
  /** Optional titles keyed by post id so the dialog can show a label before load */
  titlesById?: Record<string, string>;
  onSaved?: () => void;
  className?: string;
}

/**
 * Shows Edit metadata when one or more episodes are selected (admin only).
 * Opens the metadata editor for the first selected episode.
 */
const AdminSelectedPostEdit: React.FC<AdminSelectedPostEditProps> = ({
  postIds,
  titlesById,
  onSaved,
  className = ''
}) => {
  const { isAdmin } = useAuth();

  const selectedId = useMemo(() => {
    if (postIds.length === 0) return null;
    return normalizePostId(postIds[0]);
  }, [postIds]);

  if (!isAdmin || !selectedId) return null;

  const postTitle = titlesById?.[selectedId] || 'Selected episode';

  return (
    <span className={className || undefined}>
      <AdminPostEditButton postId={selectedId} postTitle={postTitle} onSaved={onSaved} />
    </span>
  );
};

export default AdminSelectedPostEdit;
