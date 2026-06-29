export type AccessType = 'rss' | 'streaming' | 'both' | 'download';

export const ACCESS_TYPE_OPTIONS: AccessType[] = ['streaming', 'rss', 'both', 'download'];

export const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full';
export const PREVIEW_STREAM_SECONDS = 60;

export const memberIsPaying = (value?: boolean | number | null): boolean =>
  value === true || value === 1;

export const memberIsNotSubscribed = (paymentCategory?: string | null): boolean =>
  (paymentCategory || NOT_SUBSCRIBED_PAYMENT_CATEGORY) === NOT_SUBSCRIBED_PAYMENT_CATEGORY;

export const memberHasFullStreamAccess = (
  isPaying?: boolean | number | null,
  paymentCategory?: string | null
): boolean => memberIsPaying(isPaying) && !memberIsNotSubscribed(paymentCategory);

export const memberStreamPreviewSeconds = (paymentCategory?: string | null): number | null =>
  memberIsNotSubscribed(paymentCategory) ? PREVIEW_STREAM_SECONDS : null;

export const memberHasStreamAccess = (
  isPaying?: boolean | number | null,
  accessType?: string | null,
  paymentCategory?: string | null
): boolean =>
  memberCanStream(accessType) &&
  (memberHasFullStreamAccess(isPaying, paymentCategory) || memberIsNotSubscribed(paymentCategory));

export const memberCanPlayEpisode = (
  isPaying?: boolean | number | null,
  accessType?: string | null,
  paymentCategory?: string | null,
  episodeAccessible?: boolean
): boolean =>
  memberHasStreamAccess(isPaying, accessType, paymentCategory) &&
  (!!episodeAccessible || memberIsNotSubscribed(paymentCategory));

export const memberHasDownloadAccess = (
  isPaying?: boolean | number | null,
  accessType?: string | null,
  paymentCategory?: string | null
): boolean =>
  memberIsPaying(isPaying) &&
  !memberIsNotSubscribed(paymentCategory) &&
  memberCanDownload(accessType);

export const memberCanDownload = (accessType?: string | null): boolean =>
  accessType === 'download';

export const memberCanStream = (accessType?: string | null): boolean =>
  accessType === 'streaming' || accessType === 'both';

export const memberCanRss = (accessType?: string | null): boolean =>
  accessType === 'rss' || accessType === 'both';
