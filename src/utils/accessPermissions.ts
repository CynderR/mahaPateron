export type AccessType = 'rss' | 'streaming' | 'both' | 'download';

export const ACCESS_TYPE_OPTIONS: AccessType[] = ['streaming', 'rss', 'both', 'download'];

export const memberIsPaying = (value?: boolean | number | null): boolean =>
  value === true || value === 1;

export const memberHasStreamAccess = (
  isPaying?: boolean | number | null,
  accessType?: string | null
): boolean => memberIsPaying(isPaying) && memberCanStream(accessType);

export const memberHasDownloadAccess = (
  isPaying?: boolean | number | null,
  accessType?: string | null
): boolean => memberIsPaying(isPaying) && memberCanDownload(accessType);

export const memberCanDownload = (accessType?: string | null): boolean =>
  accessType === 'download';

export const memberCanStream = (accessType?: string | null): boolean =>
  accessType === 'streaming' || accessType === 'both';

export const memberCanRss = (accessType?: string | null): boolean =>
  accessType === 'rss' || accessType === 'both';
