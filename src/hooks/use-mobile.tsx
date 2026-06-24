import * as React from "react";

const MOBILE_BREAKPOINT = 768;
/**
 * Phase 2 P2.3 — tablet/desktop breakpoint for the split-canvas layout in
 * `DocumentViewer`. >=1024px widens the main PDF canvas (DESKTOP_CAP raised
 * 800 -> 1100) and reveals the right-side panel containing the signers
 * list, role legend, and page thumbnails. Aligned with iPad (1024x768),
 * iPad Air (1180x820), and iPad Pro (1366x1024) landscape widths.
 */
export const TABLET_BREAKPOINT = 1024;

/**
 * Reactive `window.matchMedia` hook. Returns `undefined` during SSR / first
 * paint so callers can opt to render their mobile fallback until the
 * viewport is known — this avoids React hydration mismatches and the
 * "content jumping on load" warning you get with eager `useState`.
 *
 * Why not just `window.innerWidth < 1024`:
 *   - `window.innerWidth` only updates on resize. Using matchMedia means the
 *     listener fires only when the breakpoint boundary is crossed, so a
 *     mid-render tree that subscribes to `(min-width: 1024px)` doesn't
 *     re-render twice (resize event + viewport cap recompute). The browser
 *     debounces matchMedia events naturally.
 *   - `addEventListener('change', ...)` works on every browser we support;
 *     the deprecated `addListener` is intentionally avoided.
 *
 * Stable across StrictMode double-mount because the `matchMedia` instance
 * is created inside the effect each time but `removeEventListener` cleans
 * up the prior subscription on the next mount.
 */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setMatches(false);
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback (defensive — modern Safari supports addEventListener).
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * Phase 2 P2.3 — convenience export. Returns true when the viewport is
 * wide enough for the split-canvas layout (>= 1024px). Until the
 * matchMedia effect first paints we return `undefined` so callers can
 * opt to render the mobile fallback (avoids SSR mismatch and the
 * "wrong layout for one frame" flash).
 */
export function useIsTabletOrLarger(): boolean {
  return !!useMediaQuery(`(min-width: ${TABLET_BREAKPOINT}px)`);
}
