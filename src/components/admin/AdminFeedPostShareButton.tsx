import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { buildPublicSharePostUrl } from '../../config';

interface AdminFeedPostShareButtonProps {
  postId: string;
  postTitle: string;
  shareToken?: string | null;
  isPublished?: boolean;
  className?: string;
}

const AdminFeedPostShareButton: React.FC<AdminFeedPostShareButtonProps> = ({
  postId,
  postTitle,
  shareToken,
  isPublished = true,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resolvedToken, setResolvedToken] = useState<string | null>(shareToken || null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResolvedToken(shareToken || null);
  }, [shareToken, postId]);

  const activeToken = resolvedToken || shareToken || null;
  const url = useMemo(
    () => (activeToken ? buildPublicSharePostUrl(activeToken, postTitle) : ''),
    [activeToken, postTitle]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeToken) return;
    let cancelled = false;
    setLoading(true);
    setFetchError('');
    axios
      .get<{ share_token: string }>(`/admin/posts/${encodeURIComponent(postId)}/share-link`)
      .then((res) => {
        if (!cancelled) setResolvedToken(res.data.share_token);
      })
      .catch(() => {
        if (!cancelled) setFetchError('Could not create a share link for this episode.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId, activeToken]);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <div ref={rootRef} className={`admin-feed-share ${className}`.trim()}>
      <button
        type="button"
        className="pod-btn pod-btn-secondary pod-btn-sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Share
      </button>
      {open && (
        <div className="admin-feed-share-menu" role="dialog" aria-label={`Share ${postTitle}`}>
          <p className="admin-feed-share-label">{postTitle}</p>
          {!isPublished && (
            <p className="admin-feed-share-hint">Publish this episode before sharing the link.</p>
          )}
          {isPublished && (
            <p className="admin-feed-share-hint">
              Anyone with this link can browse and listen to all published episodes.
            </p>
          )}
          {loading && <p className="admin-feed-share-hint">Preparing link…</p>}
          {fetchError && <p className="admin-feed-share-hint">{fetchError}</p>}
          {url && (
            <>
              <div className="pod-copy-row admin-feed-share-copy">
                <input
                  className="pod-input"
                  type="text"
                  value={url}
                  readOnly
                  aria-label={`Share link for ${postTitle}`}
                  onFocus={(e) => e.target.select()}
                />
                <button type="button" className="pod-btn pod-btn-sm" onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="pod-btn pod-btn-secondary pod-btn-sm admin-feed-share-open"
              >
                {postTitle}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminFeedPostShareButton;
