const ACCESS_TYPES = ['rss', 'streaming', 'both'];
const NOT_SUBSCRIBED_PAYMENT_CATEGORY = 'full';
const FREE_PAYMENT_CATEGORY = 'free';
const PREVIEW_STREAM_SECONDS = 60;

const memberIsPaying = (user) => {
  const value = user?.is_paying;
  return value === 1 || value === true || value === '1';
};

const userIsNotSubscribed = (user) =>
  (user?.payment_category || NOT_SUBSCRIBED_PAYMENT_CATEGORY) === NOT_SUBSCRIBED_PAYMENT_CATEGORY &&
  !memberIsPaying(user);

const userHasFullStreamAccess = (user) => {
  if (!user) return false;
  if (user.payment_category === FREE_PAYMENT_CATEGORY) return true;
  if (user.payment_category === 'non_card') return memberIsPaying(user);
  return memberIsPaying(user) && !userIsNotSubscribed(user);
};

const userHasShareMemberFullAccess = (user) => {
  if (!user) return false;
  // Share links: only active members (free, non_card, or paid paying_subscriber).
  if (userIsNotSubscribed(user)) return false;
  if (user.payment_category === 'paying_subscriber' && !memberIsPaying(user)) return false;
  return true;
};

const userSubscriptionInactive = (user) => {
  if (!user) return true;
  if (user.payment_category === FREE_PAYMENT_CATEGORY) return false;
  if (user.payment_category === 'non_card') return false;
  if (userIsNotSubscribed(user)) return false;
  return !memberIsPaying(user);
};

const streamPreviewSeconds = (user) => (userIsNotSubscribed(user) ? PREVIEW_STREAM_SECONDS : null);

const userHasDownloadAccess = (user) =>
  !!user?.download_access &&
  memberIsPaying(user) &&
  !userIsNotSubscribed(user);

const userHasFullCatalogAccess = (user) => {
  if (!user) return false;
  if (user.payment_category === FREE_PAYMENT_CATEGORY) return true;
  if (user.back_catalog_access) return true;
  if (memberIsPaying(user)) return true;
  return userHasFullStreamAccess(user);
};

const accessFlags = (user) => {
  const type = user?.access_type || 'streaming';
  const streamType = type === 'download' ? 'streaming' : type;
  const canStreamType = streamType === 'streaming' || streamType === 'rss' || streamType === 'both';
  const canStreamMember =
    userHasFullStreamAccess(user) ||
    userIsNotSubscribed(user) ||
    user?.payment_category === FREE_PAYMENT_CATEGORY;
  return {
    canRss: streamType === 'rss' || streamType === 'both',
    canStream: canStreamType && canStreamMember,
    canDownload: userHasDownloadAccess(user)
  };
};

const previewMaxByte = (fileSize, durationSecs) => {
  if (durationSecs && durationSecs > 0) {
    const ratio = Math.min(1, PREVIEW_STREAM_SECONDS / durationSecs);
    return Math.max(0, Math.floor(fileSize * ratio) - 1);
  }
  return Math.min(fileSize - 1, PREVIEW_STREAM_SECONDS * 16 * 1024);
};

module.exports = {
  ACCESS_TYPES,
  NOT_SUBSCRIBED_PAYMENT_CATEGORY,
  FREE_PAYMENT_CATEGORY,
  PREVIEW_STREAM_SECONDS,
  memberIsPaying,
  accessFlags,
  userIsNotSubscribed,
  userHasFullStreamAccess,
  userHasFullCatalogAccess,
  userHasShareMemberFullAccess,
  userSubscriptionInactive,
  streamPreviewSeconds,
  previewMaxByte,
  userHasDownloadAccess
};
