import { useCallback, useEffect, useRef } from 'react';

const ROOT_MARGIN_PX = 600;

const isVisible = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return el.getClientRects().length > 0;
};

const pickVisibleSentinel = (nodes: Set<HTMLDivElement>): HTMLDivElement | null => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6e2f4ce6-d23e-49c6-a2a1-a23bf82f5433',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'817be1'},body:JSON.stringify({sessionId:'817be1',runId:'post-fix',hypothesisId:'A',location:'useInfiniteScroll.ts:pickVisibleSentinel',message:'pickVisibleSentinel called',data:{size:nodes.size},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  for (const node of Array.from(nodes)) {
    if (isVisible(node)) return node;
  }
  return null;
};

const prefersScrollFallback = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
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

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      nodesRef.current.add(node);
    }
    bindRef.current?.();
  }, []);

  useEffect(() => {
    if (!enabled) {
      bindRef.current = null;
      return;
    }

    let observer: IntersectionObserver | null = null;
    let scrollRaf = 0;

    const maybeLoadMore = () => {
      const target = pickVisibleSentinel(nodesRef.current);
      if (!target || !isNearViewport(target)) return;
      onLoadMoreRef.current();
    };

    const bind = () => {
      observer?.disconnect();
      observer = null;

      const target = pickVisibleSentinel(nodesRef.current);
      if (!target) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            onLoadMoreRef.current();
          }
        },
        { root: null, rootMargin: `${ROOT_MARGIN_PX}px 0px`, threshold: 0 }
      );
      observer.observe(target);
      maybeLoadMore();
    };

    bindRef.current = bind;
    bind();

    const onScroll = () => {
      if (!prefersScrollFallback()) return;
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        maybeLoadMore();
      });
    };

    const onLayoutChange = () => {
      bind();
      maybeLoadMore();
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
