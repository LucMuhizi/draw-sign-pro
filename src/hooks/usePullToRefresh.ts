import { useState, useRef, useCallback } from "react";

interface UsePullToRefreshOptions {
  /** Callback when refresh is triggered. Should return a promise. */
  onRefresh: () => Promise<void>;
  /** Distance in px required to trigger refresh */
  threshold?: number;
  /** Max pull distance in px */
  maxPull?: number;
  /** Whether pull-to-refresh is disabled */
  disabled?: boolean;
}

interface UsePullToRefreshResult {
  /** Bind these to the scrollable container div */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    style?: React.CSSProperties;
  };
  /** Current pull distance (use to render indicator) */
  pullDistance: number;
  /** Whether a refresh is in progress */
  refreshing: boolean;
}

/**
 * Touch-based pull-to-refresh hook for mobile.
 * Attaches to a scrollable container element.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 160,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return;
      const target = e.currentTarget as HTMLElement;
      // Only trigger when scrolled to top
      if (target.scrollTop > 5) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    },
    [disabled, refreshing],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || disabled || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta < 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      // Rubber-band easing
      const eased = Math.min(delta * 0.4, maxPull);
      setPullDistance(eased);
    },
    [disabled, refreshing, maxPull],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(60); // Keep indicator visible during refresh
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  return {
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      style: pullDistance > 0
        ? {
            transform: `translateY(${pullDistance}px)`,
            transition: refreshing ? "none" : "transform 0.2s ease-out",
          }
        : undefined,
    },
    pullDistance,
    refreshing,
  };
}
