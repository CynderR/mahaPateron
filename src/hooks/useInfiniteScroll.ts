import { useCallback, useEffect, useRef } from 'react';

const ROOT_MARGIN_PX = 600;

const isVisible = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return el.getClientRects().length > 0;
};

const pickVisibleSentinel = (nodes: Set<HTMLDivElement>): HTMLDivElement | null => {
  for (const node of Array.from(nodes)) {
    if (isVisible(node)) return node;
  }
  return null;
};

const prefersScrollFallback = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
};

/** True when the sentinel is actually on-screen (not merely within rootMargin preload). */
const isInViewport = (el: HTMLElement): boolean => {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
};

const isNearViewport = (el: HTMLElement): boolean => {
  const rect = el.getBoundingClientRect();
  return rect.top <= window.innerHeight + ROOT_MARGIN_PX;
};

export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const nodesRef = useRef<Set<HTMLDivElement>>(new Set());
  const bindRef = useRef<(() => void) | null>(null);
  /** Stays locked from a trigger until the parent disables the hook (loading finishes). */
  const loadLockRef = useRef(false);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      nodesRef.current.add(node);
    } else {
      for (const existing of Array.from(nodesRef.current)) {
        if (!existing.isConnected) nodesRef.current.delete(existing);
      }
    }
    bindRef.current?.();
  }, []);

  useEffect(() => {
    if (!enabled) {
      bindRef.current = null;
      // Parent flipped loading/hasMore — unlock so the next scroll can load again.
      loadLockRef.current = false;
      return;
    }

    let observer: IntersectionObserver | null = null;
    let scrollRaf = 0;

    const requestLoadMore = () => {
      if (loadLockRef.current) return;
      loadLockRef.current = true;
      onLoadMoreRef.current();
    };

    const maybeLoadMore = (requireInViewport: boolean) => {
      const target = pickVisibleSentinel(nodesRef.current);
      if (!target) return;
      if (requireInViewport ? !isInViewport(target) : !isNearViewport(target)) return;
      requestLoadMore();
    };

    const bind = (autoFill: boolean) => {
      observer?.disconnect();
      observer = null;

      const target = pickVisibleSentinel(nodesRef.current);
      if (!target) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            requestLoadMore();
          }
        },
        { root: null, rootMargin: `${ROOT_MARGIN_PX}px 0px`, threshold: 0 }
      );
      observer.observe(target);

      // Only auto-fill when the first page doesn't cover the screen.
      // Do NOT use rootMargin here — that caused rapid page cascades and scroll jitter.
      if (autoFill) maybeLoadMore(true);
    };

    bindRef.current = () => bind(false);
    bind(true);

    const onScroll = () => {
      if (!prefersScrollFallback()) return;
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        maybeLoadMore(false);
      });
    };

    const onLayoutChange = () => {
      bind(false);
    };

    if (prefersScrollFallback()) {
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('scroll', onScroll, { passive: true });
      window.visualViewport?.addEventListener('scroll', onScroll);
      window.visualViewport?.addEventListener('resize', onLayoutChange);
    }

    const media = window.matchMedia('(max-width: 768px)');
    media.addEventListener('change', onLayoutChange);

    return () => {
      bindRef.current = null;
      observer?.disconnect();
      if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll);
      window.visualViewport?.removeEventListener('scroll', onScroll);
      window.visualViewport?.removeEventListener('resize', onLayoutChange);
      media.removeEventListener('change', onLayoutChange);
    };
  }, [enabled]);

  return sentinelRef;
}
