import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

interface BulkDeleteEpisodesProps {
  postIds: string[];
  onComplete?: (deletedIds: string[]) => void;
  className?: string;
}

const BulkDeleteEpisodes: React.FC<BulkDeleteEpisodesProps> = ({
  postIds,
  onComplete,
  className = ''
}) => {
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isAdmin || postIds.length === 0) return null;

  const handleDelete = async () => {
    const count = postIds.length;
    const label = count === 1 ? '1 episode' : `${count} episodes`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setBusy(true);
    const deleted: string[] = [];
    let failed = 0;

    try {
      for (const postId of postIds) {
        try {
          await axios.delete(`/admin/posts/${postId}`);
          deleted.push(postId);
        } catch {
          failed += 1;
        }
      }

      if (deleted.length > 0) {
        onComplete?.(deleted);
      }

      if (failed > 0) {
        const msg =
          deleted.length > 0
            ? `Deleted ${deleted.length} of ${count}. ${failed} could not be deleted.`
            : 'Could not delete the selected episodes.';
        window.alert(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`pod-btn pod-btn-sm pod-btn-danger${className ? ` ${className}` : ''}`}
      disabled={busy}
      onClick={handleDelete}
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
};

export default BulkDeleteEpisodes;
