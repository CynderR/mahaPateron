export type AccessType = 'rss' | 'streaming' | 'both' | 'download';

export const ACCESS_TYPE_OPTIONS: AccessType[] = ['streaming', 'rss', 'both', 'download'];

export const memberCanDownload = (accessType?: string | null): boolean =>
  accessType === 'download' || accessType === 'both' || accessType === 'streaming';

export const memberCanStream = (accessType?: string | null): boolean =>
  accessType === 'streaming' || accessType === 'both';

export const memberCanRss = (accessType?: string | null): boolean =>
  accessType === 'rss' || accessType === 'both';
