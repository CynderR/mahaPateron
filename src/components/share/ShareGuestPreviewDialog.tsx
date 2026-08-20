import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

const DISMISS_KEY = 'shareGuestPreviewDismissed';

export const wasShareGuestPreviewDismissed = (): boolean => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

export const markShareGuestPreviewDismissed = (): void => {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Ignore private-mode / storage errors.
  }
};

interface ShareGuestPreviewDialogProps {
  open: boolean;
  onContinue: () => void;
}

const ShareGuestPreviewDialog: React.FC<ShareGuestPreviewDialogProps> = ({ open, onContinue }) => {
  const titleId = useId();
  const descriptionId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    continueRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onContinue();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onContinue]);

  if (!open) return null;

  return createPortal(
    <div
      className="share-guest-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onContinue();
      }}
    >
      <div
        className="share-guest-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId} className="share-guest-dialog-title">
          You are not signed in
        </h2>
        <p id={descriptionId} className="share-guest-dialog-body">
          Sign in to your account for full episodes. Without signing in you can still listen to a
          2-minute preview.
        </p>
        <div className="share-guest-dialog-actions">
          <Link to="/signin" className="pod-btn share-guest-dialog-primary">
            Sign in
          </Link>
          <button
            ref={continueRef}
            type="button"
            className="pod-btn pod-btn-secondary"
            onClick={onContinue}
          >
            Continue with preview
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShareGuestPreviewDialog;
