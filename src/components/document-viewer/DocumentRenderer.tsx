import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonDocumentPage } from "@/components/Skeleton";
import { PageThumbnailSidebar } from "@/components/document-viewer/PageThumbnailSidebar";
import type { SignaturePlacement } from "@/lib/pdfSigner";
import type { ReactNode } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentRendererProps {
  fileUrl: string;
  isImage: boolean;
  currentPage: number;
  numPages: number;
  pageWidth: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  signatures: SignaturePlacement[];
  onDocumentLoadSuccess: (result: { numPages: number }) => void;
  onPageChange: (page: number) => void;
  /** Pointer event handlers delegated from parent */
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  /** Children rendered as absolute overlays within the document container */
  children?: ReactNode;
}

export function DocumentRenderer({
  fileUrl,
  isImage,
  currentPage,
  numPages,
  pageWidth,
  containerRef,
  signatures,
  onDocumentLoadSuccess,
  onPageChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: DocumentRendererProps) {
  return (
    // Phase 2 P2.2 — page thumbnails sidebar.
    //
    // Why the sidebar lives *outside* the existing containerRef wrapper:
    //   1) `containerRef` is the coordinate origin for SignaturePlacementLayer
    //      pointer events and for `downloadSignedDocument`'s image capture.
    //      Pulling the sidebar into the same wrapper would offset every
    //      click coordinate by the sidebar width and bleed the sidebar's
    //      background into the exported signed image. Keeping `containerRef`
    //      on the page column preserves both behaviours unchanged.
    //   2) The sidebar uses `display: none` below the `md` breakpoint
    //      (handled inside PageThumbnailSidebar itself), so on mobile the
    //      flex layout collapses — the page column takes 100% width with
    //      no JS branching needed at this level.
    <div className="md:flex md:gap-2 md:items-start relative">
      {!isImage && numPages > 1 && (
        <PageThumbnailSidebar
          fileUrl={fileUrl}
          numPages={numPages}
          currentPage={currentPage}
          onPageChange={onPageChange}
          signatures={signatures}
        />
      )}
      <div
        ref={containerRef}
        className="relative bg-accent/20 rounded-xl overflow-hidden border border-border/50 flex-1 min-w-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
      {isImage ? (
        <img src={fileUrl} alt="Document" className="w-full h-auto max-w-full" />
      ) : (
        <>
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<SkeletonDocumentPage className="m-4 mx-auto" />}
          >
            <Page pageNumber={currentPage} width={pageWidth} />
          </Document>
          {/* Overlay skeleton until onLoadSuccess fires (handles blob URL warmup) */}
          {numPages === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <SkeletonDocumentPage className="mx-auto" />
            </div>
          )}
        </>
      )}

      {/* Overlay children (signatures, detected fields) — positioned relative to document */}
      {children}

      {/* Page indicator dots — kept as a mobile-fallback navigation aid.
          On desktop the thumbnail sidebar (Phase 2 P2.2) replaces this
          visually, but on small screens / single-page PDFs it remains the
          only page-position signal. We move the dots slightly higher so
          they don't collide with the auto-detect button row on very short
          pages. */}
      {!isImage && numPages > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-background/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-border/50 z-10">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                p === currentPage
                  ? "bg-primary scale-125 shadow-glow"
                  : signatures.some((s) => s.page === p)
                    ? "bg-primary/50"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              title={`Page ${p}${signatures.some((s) => s.page === p) ? " (has signatures)" : ""}`}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

export function PageNavigation({ currentPage, numPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-2 py-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-sm text-muted-foreground min-w-[60px] text-center font-mono">
        {currentPage} / {numPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
        disabled={currentPage === numPages}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
