import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  memberHasDownloadAccess,
  memberHasStreamAccess,
  memberIsPaying
} from '../utils/accessPermissions';

interface AccessMeta {
  is_paying?: boolean | number | null;
  canStream?: boolean | null;
  canDownload?: boolean | null;
}

export const useMemberAccess = (meta?: AccessMeta | null) => {
  const { user } = useAuth();

  return useMemo(() => {
    const isPayingMember = user
      ? memberIsPaying(user.is_paying)
      : memberIsPaying(meta?.is_paying);

    const canStream = user
      ? memberHasStreamAccess(user.is_paying, user.access_type)
      : !!(memberIsPaying(meta?.is_paying) && meta?.canStream);

    const canDownload = user
      ? memberHasDownloadAccess(user.is_paying, user.access_type)
      : !!(memberIsPaying(meta?.is_paying) && meta?.canDownload);

    return { isPayingMember, canStream, canDownload };
  }, [user, meta]);
};
