"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DetectedField } from "@/lib/ocrFields";
import { FIELD_TYPE_PRIORITY } from "@/lib/ocrFields";

/**
 * AIFieldDiscovery — Phase 6 of premium-animations.
 *
 * When OCR/auto-detect identifies signature/date/initials fields, they don't
 * just appear. The user sees a sequenced "AI scan" reveal that makes the
 * detection feel intelligent:
 *
 *   1. Soft horizontal light bar sweeps across the page (left→right, 350ms)
 *   2. The detected field location glows briefly (250ms)
 *   3. The marker (dashed border) fades in + scales 0.9→1.0 (200ms)
 *   4. Next field's sequence begins after a 180ms gap
 *
 * Order: Signature → Date → Initials (most-expected first).
 *
 * Architecture note: the sweep is rendered at the *container* level (not
 * inside each field's bounding box) so it visually crosses the full page
 * width at the field's y-coordinate — rather than being clipped to the
 * field's own width (which would read as a tiny flicker, not a page scan).
 */
export interface AIFieldDiscoveryProps {
  detectedFields: DetectedField[];
  currentPage: number;
  isImage: boolean;
  onFieldClick: (field: DetectedField) => void;
  className?: string;
}

interface IndexedField extends DetectedField {
  /** Index into the sequenced animation order. 0 = first to appear. */
  revealIndex: number;
}

const STAGGER_GAP = 0.4; // seconds between field reveals
const SWEEP_DURATION = 0.35;
const GLOW_DURATION = 0.6;
const MARKER_DURATION = 0.2;
const SWEEP_LEAD = 0; // sweep starts at the field's stagger time
const GLOW_LEAD = 0.25; // glow appears 250ms after sweep starts
const MARKER_LEAD = 0.45; // marker appears 450ms after sweep starts

/** The sweep bar is 30% of the container width and animates from off-left
 *  to off-right of the page. */
const SWEEP_WIDTH_PCT = "30%";

function orderFieldsForReveal(fields: DetectedField[]): IndexedField[] {
  // 1) Sort by type priority (signature first).
  // 2) Within each type, sort by document order (page asc, y asc, x asc).
  const sorted = [...fields].sort((a, b) => {
    const p = FIELD_TYPE_PRIORITY[a.fieldType] - FIELD_TYPE_PRIORITY[b.fieldType];
    if (p !== 0) return p;
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
    return a.x - b.x;
  });
  return sorted.map((f, i) => ({ ...f, revealIndex: i }));
}

function fieldKey(field: IndexedField): string {
  return `ai-${field.page}-${field.revealIndex}-${Math.round(field.x)}-${Math.round(field.y)}`;
}

export function AIFieldDiscovery({
  detectedFields,
  currentPage,
  isImage,
  onFieldClick,
  className,
}: AIFieldDiscoveryProps) {
  const reduceMotion = useReducedMotion();
  const ordered = React.useMemo(() => orderFieldsForReveal(detectedFields), [detectedFields]);

  // The fields to render on the current "page" (image = page 1 for our purposes).
  const visibleFields = ordered.filter((f) => isImage || f.page === currentPage);

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {/* Pass 1: page-wide sweeps, one per visible field, positioned at the
          field's y-coordinate and spanning a large fraction of the page
          width. Each sweep crosses the page from left→right and is staggered
          by reveal index so the user sees a single coordinated "scan" effect. */}
      {!reduceMotion &&
        visibleFields.map((field) => {
          const baseDelay = field.revealIndex * STAGGER_GAP;
          const sweepY = field.y + field.height / 2;
          return (
            <motion.div
              key={`${fieldKey(field)}-sweep`}
              aria-hidden
              className="absolute h-0.5 rounded-full pointer-events-none"
              style={{
                top: sweepY,
                left: 0,
                width: SWEEP_WIDTH_PCT,
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.55) 50%, transparent 100%)",
                boxShadow: "0 0 12px 2px hsl(var(--primary) / 0.35)",
              }}
              initial={{ x: "-50%", opacity: 0 }}
              animate={{ x: "400%", opacity: [0, 1, 1, 0] }}
              transition={{
                duration: SWEEP_DURATION,
                delay: baseDelay + SWEEP_LEAD,
                times: [0, 0.2, 0.8, 1],
                ease: "easeInOut",
              }}
            />
          );
        })}

      {/* Pass 2: per-field glow + marker. */}
      {visibleFields.map((field) => {
        const baseDelay = field.revealIndex * STAGGER_GAP;
        if (reduceMotion) {
          return (
            <button
              key={fieldKey(field)}
              className="absolute border-2 border-dashed border-blue-400/70 rounded-lg cursor-pointer hover:bg-blue-400/10 transition-colors flex items-center justify-center group pointer-events-auto"
              style={{
                left: field.x,
                top: field.y,
                width: field.width,
                height: field.height,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onFieldClick(field);
              }}
              aria-label={`Detected ${field.fieldType} field: ${field.label}`}
            >
              <span className="text-[10px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 px-1 rounded whitespace-nowrap">
                {field.label}
              </span>
            </button>
          );
        }
        return (
          <motion.div
            key={fieldKey(field)}
            className="absolute pointer-events-none"
            style={{
              left: field.x,
              top: field.y,
              width: field.width,
              height: field.height,
            }}
          >
            {/* Glow flash at the field's location. */}
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ backgroundColor: "hsl(var(--primary) / 0.18)" }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: [0, 0.7, 0], scale: [0.9, 1.1, 1] }}
              transition={{
                duration: GLOW_DURATION,
                delay: baseDelay + GLOW_LEAD,
                times: [0, 0.4, 1],
                ease: "easeOut",
              }}
            />

            {/* The actual clickable marker. */}
            <motion.button
              className="absolute inset-0 border-2 border-dashed border-blue-400/70 rounded-lg cursor-pointer hover:bg-blue-400/10 transition-colors flex items-center justify-center group pointer-events-auto"
              style={{ backgroundColor: "transparent" }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: MARKER_DURATION,
                delay: baseDelay + MARKER_LEAD,
                ease: "easeOut",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onFieldClick(field);
              }}
              aria-label={`Detected ${field.fieldType} field: ${field.label}`}
            >
              <span className="text-[10px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 px-1 rounded whitespace-nowrap">
                {field.label}
              </span>
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}
