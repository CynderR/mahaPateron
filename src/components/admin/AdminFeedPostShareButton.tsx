import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildPublicSharePostUrl } from '../../config';

interface AdminFeedPostShareButtonProps {
  shareToken?: string | null;
  isPublished?: boolean;
  className?: string;
}

const AdminFeedPostShareButton: React.FC<AdminFeedPostShareButtonProps> = ({
  shareToken,
  isPublished = true,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const url = useMemo(
    () => (shareToken ? buildPublicSharePostUrl(shareToken) : ''),
    [shareToken]
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

  if (!shareToken) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this public link:', url);
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
        Share link
      </button>
      {open && (
        <div className="admin-feed-share-menu" role="dialog" aria-label="Public episode link">
          <p className="admin-feed-share-label">Public listen link</p>
          {!isPublished && (
            <p className="admin-feed-share-hint">Publish this episode before sharing the link.</p>
          )}
          <div className="pod-copy-row admin-feed-share-copy">
            <input className="pod-input" type="text" value={url} readOnly onFocus={(e) => e.target.select()} />
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
            Preview link
          </a>
        </div>
      )}
    </div>
  );
};

export default AdminFeedPostShareButton;
