import { useEffect, useRef } from 'react';
import { isIOSDevice } from '../utils/streamLoader';

export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el) return;

    const maybeLoadMore = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 600) {
        onLoadMoreRef.current();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current();
        }
      },
      { root: null, rootMargin: '600px 0px', threshold: 0 }
    );

    observer.observe(el);

    let scrollRaf = 0;
    const onScroll = () => {
      if (!isIOSDevice()) return;
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        maybeLoadMore();
      });
    };

    if (isIOSDevice()) {
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('scroll', onScroll, { passive: true });
      maybeLoadMore();
    }

    return () => {
      observer.disconnect();
      if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);

  return sentinelRef;
}
