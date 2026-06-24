import { useEffect, useRef, useState } from "react";
import { pdfjs } from "react-pdf";
import { FileSignature } from "lucide-react";
import type { SignaturePlacement } from "@/lib/pdfSigner";
import { cn } from "@/lib/utils";

// Mirror DocumentRenderer's worker config so this module is safe to import
// before DocumentRenderer mounts (e.g. when a code-split chunk loads the
// sidebar first). Idempotent — calling twice is a no-op.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Target thumbnail width in CSS pixels. Page aspect ratio is preserved by
 * computing the matching viewport height from pdfjs.getViewport({ scale: 1 }).
 * 96px keeps the sidebar compact while still readable on retina.
 */
const THUMB_TARGET_WIDTH = 96;

/**
 * IntersectionObserver rootMargin — pre-render thumbnails 200px outside the
 * viewport so scrolling never reveals an unrendered page. With 96px thumbs
 * this eagerly prepares ~4–6 neighbors of the visible window.
 */
const IO_ROOT_MARGIN = "200px 0px";

interface PageThumbnailSidebarProps {
  /** Blob/object URL of the PDF. Re-loads the source document when this changes. */
  fileUrl: string;
  /** Total pages; sidebar renders nothing when <= 1 (single-page docs / images). */
  numPages: number;
  /** Active 1-indexed page. Drives active styling + scroll-into-view sync. */
  currentPage: number;
  /** Click handler — caller switches to that page (DocumentViewer owns the state). */
  onPageChange: (page: number) => void;
  /** Placements are derived per-page to render the badge count. */
  signatures: SignaturePlacement[];
}

interface PageThumbnailSidebarState {
  pdfDoc: pdfjs.PDFDocumentProxy | null;
  loadError: string | null;
}

/**
 * Vertical page-thumbnails sidebar for multi-page PDFs.
 *
 * Why a separate component:
 *   - DocumentRenderer was already at a sensible size; adding the sidebar
 *     inline + IntersectionObserver + render-cancellation logic would push
 *     it well past 200 lines.
 *   - The sidebar is genuinely self-contained: given (fileUrl, numPages,
 *     currentPage, onPageChange, signatures) it has everything it needs.
 *   - Easier to unit-test (dependency-inject pdfjs via props isn't needed
 *     today, but it's a one-prop swap if we ever want to).
 *
 * Why IntersectionObserver (vs render-everything-on-mount):
 *   - A 50-page PDF rendered eagerly burns ~10–15 MB of canvas memory and
 *     ~3 s on mid-range Android. Observing with 200px rootMargin keeps the
 *     active page + 4–6 neighbours ready, which is what the user actually
 *     sees during scroll.
 *
 * Why a ref map for scroll-into-view:
 *   - We need to scroll the active thumb inside its scroll container after
 *     the page change, without forcing every thumb to re-render via state.
 *     Storing wrapper refs in a Map keeps the operation O(1) and the parent
 *     render-free.
 */
export function PageThumbnailSidebar({
  fileUrl,
  numPages,
  currentPage,
  onPageChange,
  signatures,
}: PageThumbnailSidebarProps) {
  const [state, setState] = useState<PageThumbnailSidebarState>({ pdfDoc: null, loadError: null });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());
  // Keep a ref to the most recent pdfDoc so the unmount cleanup can destroy
  // it even after the component has unmounted (state is no longer readable).
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  pdfDocRef.current = state.pdfDoc;

  // Load the PDF document once per fileUrl change. We cancel the previous
  // open task implicitly by setting state to `null` (the caller no longer
  // holds a ref to it) and explicitly destroy on unmount below.
  useEffect(() => {
    if (!fileUrl) {
      setState({ pdfDoc: null, loadError: null });
      return;
    }
    let cancelled = false;
    setState({ pdfDoc: null, loadError: null });

    const task = pdfjs.getDocument(fileUrl);
    task.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy().catch(() => undefined);
          return;
        }
        setState({ pdfDoc: doc, loadError: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load PDF";
        setState({ pdfDoc: null, loadError: message });
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // Destroy the most recent PDFDocumentProxy on unmount. pdfjs-dist v5 holds
  // worker resources internally; without destroy(), leaving the component
  // unmounted (e.g. navigating to Index → History → back) leaks the worker
  // pool across hot-reloads.
  useEffect(() => {
    return () => {
      pdfDocRef.current?.destroy().catch(() => undefined);
      pdfDocRef.current = null;
    };
  }, []);

  // Scroll-into-view sync — when the active page changes (thumb clicked,
  // prev/next button triggered, OCR auto-advance jumped, template loaded
  // mid-document), make sure the corresponding thumbnail is visible in the
  // sidebar. Skip the scroll if the thumb is already fully visible so users
  // manually scrolling the sidebar don't get yanked around on re-renders.
  useEffect(() => {
    const el = itemRefs.current.get(currentPage);
    const container = sidebarRef.current;
    if (!el || !container) return;

    const elRect = el.getBoundingClientRect();
    const ctRect = container.getBoundingClientRect();
    const fullyVisible = elRect.top >= ctRect.top && elRect.bottom <= ctRect.bottom;
    if (fullyVisible) return;

    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  if (numPages <= 1) return null;

  return (
    <div
      ref={sidebarRef}
      className="hidden md:flex flex-col gap-1.5 w-24 flex-shrink-0 overflow-y-auto max-h-[80vh] pr-1 -mr-1 scrollbar-thin"
      aria-label="Page thumbnails"
      data-testid="page-thumbnail-sidebar"
    >
      {state.loadError && (
        <div className="text-[10px] text-destructive px-1 py-2 leading-tight">
          Thumbnails unavailable
        </div>
      )}
      {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
        <PageThumbnailItem
          key={page}
          page={page}
          active={page === currentPage}
          pdfDoc={state.pdfDoc}
          signatureCount={signatures.reduce(
            (n, s) => (s.page === page ? n + 1 : n),
            0,
          )}
          onSelect={() => onPageChange(page)}
          registerItem={(el) => {
            if (el) itemRefs.current.set(page, el);
            else itemRefs.current.delete(page);
          }}
        />
      ))}
    </div>
  );
}

interface PageThumbnailItemProps {
  page: number;
  active: boolean;
  pdfDoc: pdfjs.PDFDocumentProxy | null;
  signatureCount: number;
  onSelect: () => void;
  registerItem: (el: HTMLButtonElement | null) => void;
}

/**
 * A single thumbnail button. Observes its own bounding-box for visibility
 * and renders the canvas lazily. Multiple of these can share one
 * `pdfDoc` (we don't tear it down per thumb) — pdfjs-dist loads the PDF
 * bytes once and getPage() is cheap.
 */
function PageThumbnailItem({
  page,
  active,
  pdfDoc,
  signatureCount,
  onSelect,
  registerItem,
}: PageThumbnailItemProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const [rendered, setRendered] = useState(false);

  // Register/unregister ref so the parent's scroll-into-view sync can find
  // the active item without forcing an extra render on every current-page
  // change.
  useEffect(() => {
    registerItem(buttonRef.current);
    return () => registerItem(null);
  }, [registerItem]);

  // Lazy render — IntersectionObserver fires when the wrapper enters
  // viewport (200px rootMargin so neighbours are pre-warmed).
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !buttonRef.current) return;

    const wrapper = buttonRef.current;
    const canvas = canvasRef.current;
    let cancelled = false;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || cancelled) return;

        // Render exactly once per IntersectionObserver fire. We render-task
        // .cancel() in cleanup if the user scrolls away before it finishes.
        (async () => {
          try {
            const pdfPage = await pdfDoc.getPage(page);
            if (cancelled) {
              pdfPage.cleanup();
              return;
            }

            // Derive scale from the target CSS width; preserve aspect ratio.
            const baseViewport = pdfPage.getViewport({ scale: 1 });
            const scale = THUMB_TARGET_WIDTH / baseViewport.width;
            const viewport = pdfPage.getViewport({ scale });

            // HiDPI: bump canvas backing-store by `dpr` (capped at 2 so a 3×
            // display doesn't bloat memory for a thumbnail).
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const ctx = canvas.getContext("2d");
            if (!ctx || cancelled) {
              pdfPage.cleanup();
              return;
            }
            ctx.scale(dpr, dpr);

            renderTaskRef.current = pdfPage.render({ canvasContext: ctx, viewport });
            await renderTaskRef.current.promise;
            if (!cancelled) {
              setRendered(true);
            }
            pdfPage.cleanup();
          } catch (err: unknown) {
            // pdfjs throws RenderingCancelledException when we cancel mid-flight;
            // that's an intended outcome, not an error.
            const name = (err as { name?: string } | null)?.name;
            if (cancelled || name === "RenderingCancelledException") return;
            console.warn(`[thumbnail] page ${page} render failed`, err);
          }
        })();
      },
      { rootMargin: IO_ROOT_MARGIN, threshold: 0 },
    );
    io.observe(wrapper);

    return () => {
      cancelled = true;
      io.disconnect();
      // Cancel any in-flight render — prevents the "canvas updated after
      // unmount" warning that swallows console output in strict mode.
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, page]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-md border-2 transition-all duration-200 p-1 bg-background/60 hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-primary shadow-glow scale-[1.04]"
          : "border-border hover:border-primary/50 hover:scale-[1.02]",
      )}
      aria-label={`Go to page ${page}`}
      aria-current={active ? "page" : undefined}
      title={`Page ${page}${signatureCount ? ` • ${signatureCount} signature(s)` : ""}`}
    >
      <div className="aspect-[3/4] flex items-center justify-center bg-accent/20 rounded overflow-hidden">
        {!rendered && (
          <span
            className={cn(
              "absolute font-mono text-[10px]",
              active ? "text-primary font-bold" : "text-muted-foreground",
            )}
          >
            {page}
          </span>
        )}
        <canvas
          ref={canvasRef}
          className={cn(
            "block max-w-full max-h-full",
            rendered ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        />
      </div>
      <span
        className={cn(
          "block text-[10px] mt-1 text-center font-mono",
          active ? "text-primary font-bold" : "text-muted-foreground",
        )}
      >
        {page}
      </span>
      {signatureCount > 0 && (
        <span
          className="absolute top-1 right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-glow pointer-events-none"
          title={`${signatureCount} signature(s) on page ${page}`}
        >
          {signatureCount > 9 ? (
            <FileSignature className="w-2.5 h-2.5" />
          ) : (
            signatureCount
          )}
        </span>
      )}
    </button>
  );
}
