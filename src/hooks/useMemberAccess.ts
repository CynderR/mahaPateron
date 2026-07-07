import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  memberHasDownloadAccess,
  memberHasFullStreamAccess,
  memberHasStreamAccess,
  memberIsNotSubscribed,
  memberStreamPreviewSeconds
} from '../utils/accessPermissions';

interface AccessMeta {
  is_paying?: boolean | number | null;
  canStream?: boolean | null;
  canDownload?: boolean | null;
  streamPreviewSeconds?: number | null;
}

export const useMemberAccess = (meta?: AccessMeta | null) => {
  const { user } = useAuth();

  return useMemo(() => {
    const isNotSubscribed = user
      ? memberIsNotSubscribed(user.payment_category, user.is_paying)
      : meta?.streamPreviewSeconds != null;

    const isPayingMember = user
      ? memberHasFullStreamAccess(user.is_paying, user.payment_category)
      : !!(meta?.is_paying && !meta?.streamPreviewSeconds);

    const isInactive = !isPayingMember && !isNotSubscribed;

    const canStream = user
      ? memberHasStreamAccess(user.is_paying, user.access_type, user.payment_category)
      : !!(meta?.canStream);

    const canDownload = user
      ? memberHasDownloadAccess(user.is_paying, user.download_access, user.payment_category)
      : !!(meta?.canDownload);

    const streamPreviewSeconds = user
      ? memberStreamPreviewSeconds(user.payment_category, user.is_paying)
      : meta?.streamPreviewSeconds ?? null;

    return {
      isPayingMember,
      isNotSubscribed,
      isInactive,
      canStream,
      canDownload,
      streamPreviewSeconds
    };
  }, [user, meta]);
};
