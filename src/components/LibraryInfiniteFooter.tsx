import React from 'react';

interface LibraryInfiniteFooterProps {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  hasMore: boolean;
  showEnd?: boolean;
}

const LibraryInfiniteFooter: React.FC<LibraryInfiniteFooterProps> = ({
  sentinelRef,
  loadingMore,
  hasMore,
  showEnd = false
}) => (
  <>
    {loadingMore && <div className="pod-empty pod-infinite-loading">Loading more…</div>}
    {hasMore && <div ref={sentinelRef} className="pod-infinite-sentinel" aria-hidden />}
    {showEnd && !hasMore && !loadingMore && (
      <p className="pod-infinite-end">All episodes loaded.</p>
    )}
  </>
);

export default LibraryInfiniteFooter;
