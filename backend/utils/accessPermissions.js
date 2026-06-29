const ACCESS_TYPES = ['rss', 'streaming', 'both', 'download'];
const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full';
const PREVIEW_STREAM_SECONDS = 60;

const userIsNotSubscribed = (user) =>
  (user?.payment_category || NOT_SUBSCRIBED_PAYMENT_CATEGORY) === NOT_SUBSCRIBED_PAYMENT_CATEGORY;

const userHasFullStreamAccess = (user) => !!user?.is_paying && !userIsNotSubscribed(user);

const streamPreviewSeconds = (user) => (userIsNotSubscribed(user) ? PREVIEW_STREAM_SECONDS : null);

const accessFlags = (user) => {
  const type = user?.access_type || 'streaming';
  const canStreamType = type === 'streaming' || type === 'both';
  return {
    canRss: type === 'rss' || type === 'both',
    canStream: canStreamType && (userHasFullStreamAccess(user) || userIsNotSubscribed(user)),
    canDownload: type === 'download'
  };
};

const previewMaxByte = (fileSize, durationSecs) => {
  if (durationSecs && durationSecs > 0) {
    const ratio = Math.min(1, PREVIEW_STREAM_SECONDS / durationSecs);
    return Math.max(0, Math.floor(fileSize * ratio) - 1);
  }
  return Math.min(fileSize - 1, PREVIEW_STREAM_SECONDS * 16 * 1024);
};

const userHasDownloadCatalogAccess = (user) => user?.access_type === 'download';

module.exports = {
  ACCESS_TYPES,
  NOT_SUBSCRIBED_PAYMENT_CATEGORY,
  PREVIEW_STREAM_SECONDS,
  accessFlags,
  userIsNotSubscribed,
  userHasFullStreamAccess,
  streamPreviewSeconds,
  previewMaxByte,
  userHasDownloadCatalogAccess
};
