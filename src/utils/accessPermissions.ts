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
export const NON_CARD_PAYMENT_CATEGORY = 'non_card';
export const PAYING_SUBSCRIBER_PAYMENT_CATEGORY = 'paying_subscriber';
export const PREVIEW_STREAM_SECONDS = 60;

export const memberIsPaying = (value?: boolean | number | null): boolean =>
  value === true || value === 1;

export const memberHasDownloadEnabled = (value?: boolean | number | null): boolean =>
  value === true || value === 1;

export const memberIsNotSubscribed = (
  paymentCategory?: string | null,
  isPaying?: boolean | number | null
): boolean =>
  (paymentCategory || NOT_SUBSCRIBED_PAYMENT_CATEGORY) === NOT_SUBSCRIBED_PAYMENT_CATEGORY &&
  !memberIsPaying(isPaying);

/** Inactive paying track: category is paying_subscriber but checkout not completed. */
export const memberIsInactivePayingSubscriber = (
  paymentCategory?: string | null,
  isPaying?: boolean | number | null
): boolean => paymentCategory === PAYING_SUBSCRIBER_PAYMENT_CATEGORY && !memberIsPaying(isPaying);

export const memberHasFullStreamAccess = (
  isPaying?: boolean | number | null,
  paymentCategory?: string | null
): boolean => {
  if (paymentCategory === FREE_PAYMENT_CATEGORY) return true;
  if (paymentCategory === NON_CARD_PAYMENT_CATEGORY) return memberIsPaying(isPaying);
  return memberIsPaying(isPaying) && !memberIsNotSubscribed(paymentCategory, isPaying);
};

export const memberHasShareFullAccess = (
  paymentCategory?: string | null,
  isPaying?: boolean | number | null
): boolean => {
  if (memberIsNotSubscribed(paymentCategory, isPaying ?? true)) return false;
  if (memberIsInactivePayingSubscriber(paymentCategory, isPaying)) return false;
  return true;
};

export const memberStreamPreviewSeconds = (
  paymentCategory?: string | null,
  isPaying?: boolean | number | null
): number | null => (memberIsNotSubscribed(paymentCategory, isPaying) ? PREVIEW_STREAM_SECONDS : null);

export const memberHasStreamAccess = (
  isPaying?: boolean | number | null,
  accessType?: string | null,
  paymentCategory?: string | null
): boolean => {
  const streamType = accessType === 'download' ? 'streaming' : accessType;
  return (
    memberCanStream(streamType) &&
    (memberHasFullStreamAccess(isPaying, paymentCategory) || memberIsNotSubscribed(paymentCategory, isPaying))
  );
};

export const memberCanPlayEpisode = (
  isPaying?: boolean | number | null,
  accessType?: string | null,
  paymentCategory?: string | null,
  episodeAccessible?: boolean
): boolean =>
  memberHasStreamAccess(isPaying, accessType, paymentCategory) &&
  (!!episodeAccessible || memberIsNotSubscribed(paymentCategory, isPaying));

export const memberHasDownloadAccess = (
  isPaying?: boolean | number | null,
  downloadAccess?: boolean | number | null,
  paymentCategory?: string | null
): boolean =>
  memberIsPaying(isPaying) &&
  !memberIsNotSubscribed(paymentCategory, isPaying) &&
  memberHasDownloadEnabled(downloadAccess);

export const memberCanStream = (accessType?: string | null): boolean => {
  const streamType = accessType === 'download' ? 'streaming' : accessType;
  return streamType === 'streaming' || streamType === 'rss' || streamType === 'both';
};

export const memberCanRss = (accessType?: string | null): boolean => {
  const streamType = accessType === 'download' ? 'streaming' : accessType;
  return streamType === 'rss' || streamType === 'both';
};
