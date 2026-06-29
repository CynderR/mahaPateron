const ACCESS_TYPES = ['rss', 'streaming', 'both', 'download'];

const accessFlags = (user) => {
  const type = user?.access_type || 'streaming';
  return {
    canRss: type === 'rss' || type === 'both',
    canStream: type === 'streaming' || type === 'both',
    canDownload: type === 'download'
  };
};

const userHasDownloadCatalogAccess = (user) => user?.access_type === 'download';

module.exports = {
  ACCESS_TYPES,
  accessFlags,
  userHasDownloadCatalogAccess
};
