import { useState, useEffect, useRef } from "react";
import { Trash2, Check, Type, Calendar, Hash, Repeat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SignaturePlacement, FieldType } from "@/lib/pdfSigner";
import { expandPlacementToPage } from "@/lib/pdfSigner";
import type { RangeDraft } from "@/hooks/useSignaturePlacement";
import type { DetectedField } from "@/lib/ocrFields";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { InkedSignature } from "@/components/animations/InkedSignature";
import { AIFieldDiscovery } from "@/components/animations/AIFieldDiscovery";
import { RecipientBadge } from "@/components/document-viewer/RecipientBadge";
import type { SigningParticipant } from "@/lib/multiPartySigning";

interface SignaturePlacementLayerProps {
  signatures: SignaturePlacement[];
  detectedFields: DetectedField[];
  currentPage: number;
  isImage: boolean;
  signature?: string;
  onFieldClick: (field: DetectedField) => void;
  onSignaturePointerDown: (e: React.PointerEvent, sigId: string) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent, sigId: string, corner: string) => void;
  onRemoveSignature: (sigId: string) => void;
  onTouchStart: (e: React.TouchEvent, sigId: string) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onToggleCheckbox?: (sigId: string) => void;
  /** Multi-party: map of participant IDs to participant info */
  participants?: SigningParticipant[];
  /** Multi-party: current recipient's participant ID (to dim others) */
  currentRecipientId?: string;
  /**
   * Phase 2 P2.4 — wrapper pixel dimensions for the current page, used
   * to scale normalized range coords into absolute pixel space. When
   * omitted, range placements render at their raw (normalized) values
   * which is visually incorrect but matches the pre-P2.4 fallback so
   * unit tests with no wrapper context don't crash.
   */
  displayWidth?: number;
  displayHeight?: number;
  /**
   * Phase 2 P2.4 — range draft to render as an animated ghost. The
   * layer shows the ghost on the current page iff currentPage ∈
   * [draft.startPage, draft.endPage]. Click handlers are deliberately
   * not attached: drafts are sealed via the toolbar's "Seal" button.
   */
  rangeDraft?: RangeDraft | null;
}

function formatDateDisplay(format: string): string { return formatDate(format); }

function FieldOverlay({
  sig,
  signature,
  onRemove,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onResizeStart,
  onToggleCheckbox,
  participant,
  isOtherRecipientsField,
  isRange,
}: {
  sig: SignaturePlacement;
  signature?: string;
  onRemove: (id: string) => void;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onTouchStart: (e: React.TouchEvent, id: string) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onResizeStart: (e: React.PointerEvent, id: string, corner: string) => void;
  onToggleCheckbox?: (id: string) => void;
  participant?: SigningParticipant;
  isOtherRecipientsField?: boolean;
  /** Phase 2 P2.4 — true when this overlay represents a range
   *  placement. Adds a small banner so the user knows it's a
   *  multi-page span and not just a duplicate badge. */
  isRange?: boolean;
}) {
  const ft: FieldType = sig.fieldType || "signature";

  // Phase 2 — field completion pulse.
  // When a checkbox is toggled ON, we briefly render a green ring around the
  // field and pulse-scale the field itself (1 → 1.15 → 1 over 250ms). This
  // gives a tiny "success moment" on completion. Self-contained: the parent
  // doesn't need to track per-field state.
  const wasChecked = useRef<boolean | undefined>(sig.checked);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    const isCheckbox = sig.fieldType === "checkbox";
    if (!isCheckbox) {
      wasChecked.current = sig.checked;
      return;
    }
    if (sig.checked && !wasChecked.current) {
      setJustCompleted(true);
      const t = window.setTimeout(() => setJustCompleted(false), 800);
      wasChecked.current = sig.checked;
      return () => window.clearTimeout(t);
    }
    wasChecked.current = sig.checked;
    return undefined;
  }, [sig.checked, sig.fieldType]);

  return (
    <motion.div
      className={cn(
        // `group` is always present so the hover-driven delete / resize
        // handles continue to derive from `group-hover:opacity-100`.
        // Range placements additionally wear a primary-color ring so
        // users see at a glance that a multi-page banner is active.
        "absolute group touch-none pointer-events-auto",
        isRange && "ring-2 ring-primary/40 rounded-lg",
      )}
      style={{
        left: sig.x,
        top: sig.y,
        width: sig.width,
        height: sig.height,
        opacity: isOtherRecipientsField ? 0.35 : 1,
      }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={
        justCompleted
          ? { scale: [1, 1.15, 1], transition: { duration: 0.25, times: [0, 0.5, 1], ease: "easeOut" } }
          : { scale: 1, opacity: isOtherRecipientsField ? 0.35 : 1 }
      }
      onPointerDown={(e) => !isOtherRecipientsField && onPointerDown(e, sig.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onTouchStart={(e) => onTouchStart(e, sig.id)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Render based on field type */}
      {ft === "signature" && signature && (
        <InkedSignature
          variant="image"
          src={signature}
          skipAnimation={isOtherRecipientsField}
        />
      )}
      {ft === "typed" && (
        <div className="w-full h-full bg-background/90 rounded border border-primary/20">
          <InkedSignature
            variant="text"
            text={sig.typedText || ""}
            fontFamily="serif"
            fontSize={Math.min(sig.height * 0.45, 22)}
            color="hsl(var(--foreground))"
            skipAnimation={isOtherRecipientsField}
          />
        </div>
      )}
      {ft === "date" && (
        <div className="w-full h-full flex items-center justify-center bg-background/90 rounded border border-blue-400/30">
          <span className="text-blue-600 font-mono text-sm pointer-events-none">
            {formatDateDisplay(sig.dateFormat || "MM/DD/YYYY")}
          </span>
        </div>
      )}
      {ft === "initials" && (
        <div className="w-full h-full bg-background/90 rounded border border-primary/20">
          <InkedSignature
            variant="text"
            text={(sig.typedText || "").toUpperCase()}
            fontFamily="serif"
            fontSize={Math.min(sig.height * 0.5, 26)}
            color="hsl(var(--foreground))"
            skipAnimation={isOtherRecipientsField}
          />
        </div>
      )}
      {ft === "checkbox" && (
        <button
          className={`w-full h-full flex items-center justify-center bg-background/90 rounded border-2 transition-colors ${
            justCompleted
              ? "border-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.25)]"
              : sig.checked
                ? "border-green-500"
                : "border-foreground/30 hover:border-primary/60"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheckbox?.(sig.id);
          }}
        >
          <AnimatePresence>
            {sig.checked && (
              <motion.span
                key="check"
                className="w-full h-full flex items-center justify-center"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={
                  justCompleted
                    ? { scale: [0.4, 1.25, 1], opacity: 1 }
                    : { scale: 1, opacity: 1 }
                }
                exit={{ scale: 0.4, opacity: 0 }}
                transition={
                  justCompleted
                    ? { duration: 0.25, times: [0, 0.5, 1], ease: "easeOut" }
                    : { duration: 0.18, ease: "easeOut" }
                }
              >
                <Check className="w-full h-full text-green-600 p-1" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* Delete button — only for own fields */}
      {!isOtherRecipientsField && (
        <button
          onClick={() => onRemove(sig.id)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10 shadow-md hover:scale-110"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Resize handles — only for own fields and not checkbox */}
      {!isOtherRecipientsField && ft !== "checkbox" && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="absolute top-0 left-0 w-3 h-3 bg-primary rounded-full cursor-nw-resize -translate-x-1/2 -translate-y-1/2"
            onPointerDown={(e) => onResizeStart(e, sig.id, "tl")}
          />
          <div
            className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-full cursor-ne-resize translate-x-1/2 -translate-y-1/2"
            onPointerDown={(e) => onResizeStart(e, sig.id, "tr")}
          />
          <div
            className="absolute bottom-0 left-0 w-3 h-3 bg-primary rounded-full cursor-sw-resize -translate-x-1/2 translate-y-1/2"
            onPointerDown={(e) => onResizeStart(e, sig.id, "bl")}
          />
          <div
            className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full cursor-se-resize translate-x-1/2 translate-y-1/2"
            onPointerDown={(e) => onResizeStart(e, sig.id, "br")}
          />
        </div>
      )}

      {/* Range badge (Phase 2 P2.4) — quietly visible above the field
          so users always know a multi-page span was applied. */}
      {isRange && sig.range && (
        <div className="absolute -top-2 -left-1 z-20 opacity-90">
          <span
            className="flex items-center gap-0.5 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded shadow-glow"
            title={`Range placement spanning pages ${sig.range.startPage}-${sig.range.endPage}`}
          >
            <Repeat className="w-2.5 h-2.5" />
            <span>{sig.range.endPage - sig.range.startPage + 1}p</span>
          </span>
        </div>
      )}

      {/* Recipient badge (multi-party) */}
      {participant && (
        <div className="absolute -top-3 -left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <RecipientBadge participant={participant} small />
        </div>
      )}

      {/* Field type indicator */}
      <div className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="flex items-center gap-0.5 text-[9px] bg-background/90 px-1 py-0.5 rounded border border-border">
          {ft === "signature" && <Hash className="w-2.5 h-2.5" />}
          {ft === "typed" && <Type className="w-2.5 h-2.5" />}
          {ft === "date" && <Calendar className="w-2.5 h-2.5" />}
          {ft === "initials" && <span className="text-[8px] font-bold">IN</span>}
          {ft === "checkbox" && <Check className="w-2.5 h-2.5" />}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Phase 2 P2.4 — animated ghost for an in-progress range draft.
 *
 * Renders a dashed animated outline at the draft's normalized
 * position (scaled by the wrapper's display dims) with a small
 * "↔ Pages N-M" caption. No click/delete interactions: drafts are
 * sealed via the toolbar button or canceled via ESC.
 */
function RangeDraftGhost({
  draft,
  displayWidth,
  displayHeight,
  currentPage,
}: {
  draft: RangeDraft;
  displayWidth: number;
  displayHeight: number;
  currentPage: number;
}) {
  const x = draft.xNorm * displayWidth;
  const y = draft.yNorm * displayHeight;
  const w = draft.wNorm * displayWidth;
  const h = draft.hNorm * displayHeight;
  const inRange = currentPage >= draft.startPage && currentPage <= draft.endPage;
  if (!inRange) return null;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: x, top: y, width: w, height: h }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="w-full h-full rounded-lg border-2 border-dashed border-primary/70 bg-primary/10 flex items-center justify-center">
        <motion.div
          className="text-[10px] font-mono uppercase tracking-wide text-primary px-1.5 py-0.5 bg-background/90 rounded"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          Range {draft.startPage}–{draft.endPage}
        </motion.div>
      </div>
    </motion.div>
  );
}

export function SignaturePlacementLayer({
  signatures,
  detectedFields,
  currentPage,
  isImage,
  signature,
  onFieldClick,
  onSignaturePointerDown,
  onPointerMove,
  onPointerUp,
  onResizeStart,
  onRemoveSignature,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onToggleCheckbox,
  participants,
  currentRecipientId,
  displayWidth,
  displayHeight,
  rangeDraft,
}: SignaturePlacementLayerProps) {
  // Phase 2 P2.4 — for each placement, expand it into the current page
  // using `expandPlacementToPage`. Single-page placements on a different
  // page return null; range placements return absolute pixel coords
  // scaled to the wrapper's display dims. We then build a pseudo-SignaturePlacement
  // with the absolute coords as a shallow overlay so the existing
  // FieldOverlay component code stays untouched.
  const expanded = displayWidth && displayHeight
    ? signatures
        .map((p) => expandPlacementToPage(p, currentPage, displayWidth, displayHeight))
        .filter(Boolean)
    // Fallback (no wrapper dims from caller): keep the previous
    // filter+render behaviour so non-wrapper contexts (tests) still
    // see the right placements for their own page.
    : signatures
        .filter((s) => isImage || s.page === currentPage)
        .map((p) => ({
          page: p.page,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          base: p,
        }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Detected OCR field overlays — Phase 6 sequenced AI discovery. */}
      <AIFieldDiscovery
        detectedFields={detectedFields}
        currentPage={currentPage}
        isImage={isImage}
        onFieldClick={onFieldClick}
      />

      {/* Placed fields — AnimatePresence handles pop-in for new fields. */}
      <AnimatePresence>
        {expanded.map((entry) => {
          const overlaySig: SignaturePlacement = {
            ...entry.base,
            x: entry.x,
            y: entry.y,
            width: entry.width,
            height: entry.height,
            page: entry.page,
          };
          const participant = participants?.find((p) => p.id === overlaySig.recipientId);
          const isOther = !!currentRecipientId && !!overlaySig.recipientId && overlaySig.recipientId !== currentRecipientId;
          return (
            <FieldOverlay
              key={overlaySig.id}
              sig={overlaySig}
              signature={signature}
              onRemove={onRemoveSignature}
              onPointerDown={onSignaturePointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onResizeStart={onResizeStart}
              onToggleCheckbox={onToggleCheckbox}
              participant={participant}
              isOtherRecipientsField={isOther}
              isRange={!!entry.base.range}
            />
          );
        })}
      </AnimatePresence>

      {/* Phase 2 P2.4 — range draft ghost (only renders when the draft
          spans the current page). Pointer events stay disabled so the
          draft never blocks normal drags or click-through on the page. */}
      {rangeDraft && displayWidth !== undefined && displayHeight !== undefined && (
        <RangeDraftGhost
          draft={rangeDraft}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          currentPage={currentPage}
        />
      )}
    </div>
  );
}
