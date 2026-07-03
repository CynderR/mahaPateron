export type AccessType = 'rss' | 'streaming' | 'both';

/** Admin UI — streaming only, or streaming plus RSS feed. */
export const ADMIN_ACCESS_TYPE_OPTIONS: Array<{ value: 'streaming' | 'rss'; label: string }> = [
  { value: 'streaming', label: 'streaming' },
  { value: 'rss', label: 'rss' }
];

export const ACCESS_TYPE_OPTIONS: AccessType[] = ['streaming', 'rss', 'both'];

export const adminAccessTypeValue = (accessType?: string | null): 'streaming' | 'rss' =>
  accessType === 'rss' || accessType === 'both' ? 'rss' : 'streaming';

export const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full';
export const FREE_PAYMENT_CATEGORY = 'free';
export const PREVIEW_STREAM_SECONDS = 60;

export const memberIsPaying = (value?: boolean | number | null): boolean =>
  value === true || value === 1;

export const memberHasDownloadEnabled = (value?: boolean | number | null): boolean =>
  value === true || value === 1;

export const memberIsNotSubscribed = (paymentCategory?: string | null): boolean =>
  (paymentCategory || NOT_SUBSCRIBED_PAYMENT_CATEGORY) === NOT_SUBSCRIBED_PAYMENT_CATEGORY;

export const memberHasFullStreamAccess = (
  isPaying?: boolean | number | null,
  paymentCategory?: string | null
): boolean => {
  if (paymentCategory === FREE_PAYMENT_CATEGORY) return true;
  return memberIsPaying(isPaying) && !memberIsNotSubscribed(paymentCategory);
};

export const memberHasShareFullAccess = (paymentCategory?: string | null): boolean =>
  !memberIsNotSubscribed(paymentCategory);

export const memberStreamPreviewSeconds = (paymentCategory?: string | null): number | null =>
  memberIsNotSubscribed(paymentCategory) ? PREVIEW_STREAM_SECONDS : null;

export const memberHasStreamAccess = (
  isPaying?: boolean | number | null,
  accessType?: string | null,
  paymentCategory?: string | null
): boolean => {
  const streamType = accessType === 'download' ? 'streaming' : accessType;
  return (
    memberCanStream(streamType) &&
    (memberHasFullStreamAccess(isPaying, paymentCategory) || memberIsNotSubscribed(paymentCategory))
  );
};

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
  downloadAccess?: boolean | number | null,
  paymentCategory?: string | null
): boolean =>
  memberIsPaying(isPaying) &&
  !memberIsNotSubscribed(paymentCategory) &&
  memberHasDownloadEnabled(downloadAccess);

export const memberCanStream = (accessType?: string | null): boolean => {
  const streamType = accessType === 'download' ? 'streaming' : accessType;
  return streamType === 'streaming' || streamType === 'rss' || streamType === 'both';
};

export const memberCanRss = (accessType?: string | null): boolean => {
  const streamType = accessType === 'download' ? 'streaming' : accessType;
  return streamType === 'rss' || streamType === 'both';
};
