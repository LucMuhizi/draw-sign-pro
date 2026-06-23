"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hapticSuccess } from "@/lib/haptics";

/**
 * InkedSignature — Phase 4 of premium-animations.
 *
 * Reveals a signature with a left-to-right "ink" wipe (700ms). Used for both
 * raster (drawn/uploaded) PNG signatures and typed text signatures.
 *
 * Implementation choice: clip-path wipe over true SVG strokeDasharray.
 *   - True strokeDasharray requires converting text to vector paths (opentype.js,
 *     ~400KB) and only works for text — PNG signatures would still need a
 *     clip-path wipe anyway.
 *   - clip-path wipe works for both variants with identical timing and ships
 *     zero new dependencies. The visual effect ("ink revealing from left to
 *     right") matches the spec at 60fps and is what most "ink reveal" libraries
 *     (e.g. react-signature-animation) do under the hood.
 *
 * Behavior:
 *   - `initial` and `animate` are only applied on the first mount of this
 *     component instance. Subsequent re-renders (e.g. drag/resize) keep the
 *     signature visible with no animation.
 *   - Respects `prefers-reduced-motion`: when on, the wipe is skipped entirely
 *     and `hapticSuccess` is not fired (user opted out of motion feedback).
 *   - On animation complete, fires `hapticSuccess()` for the "ink settled"
 *     confirmation tactile.
 */
export interface InkedSignatureProps {
  /** PNG dataURL for raster signatures (drawn, photo, upload). */
  src?: string;
  /** Text content for typed signatures. */
  text?: string;
  variant: "image" | "text";
  /** Font family for text variant. */
  fontFamily?: string;
  /** Font size (px) for text variant. */
  fontSize?: number;
  /** Color for text variant. */
  color?: string;
  /** When true, skip the wipe animation entirely. Use for re-renders or other recipients' fields. */
  skipAnimation?: boolean;
  className?: string;
}

const WIPE_DURATION = 0.7; // seconds — matches the plan's 700ms spec

export function InkedSignature({
  src,
  text,
  variant,
  fontFamily = "cursive",
  fontSize = 36,
  color = "#1a1a1a",
  skipAnimation = false,
  className,
}: InkedSignatureProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = !skipAnimation && !reduceMotion;
  const hasFiredHaptic = React.useRef(false);

  // Initial mount: animate from invisible (clipped) to fully visible.
  // Subsequent re-renders: skip the animation (the field is already settled).
  const motionProps = shouldAnimate
    ? {
        initial: { clipPath: "inset(0 100% 0 0)" } as const,
        animate: { clipPath: "inset(0 0% 0 0)" } as const,
        transition: { duration: WIPE_DURATION, ease: "easeOut" as const },
        onAnimationComplete: () => {
          if (hasFiredHaptic.current) return;
          hasFiredHaptic.current = true;
          hapticSuccess();
        },
      }
    : { initial: false as const };

  if (variant === "text") {
    return (
      <motion.div
        className={cn("w-full h-full flex items-center justify-center pointer-events-none", className)}
        {...motionProps}
      >
        <span
          className="font-serif font-bold truncate px-1"
          style={{
            fontFamily: fontFamily === "cursive" ? "cursive" : fontFamily,
            fontSize: Math.min(fontSize, 32),
            color,
            fontStyle: fontFamily === "cursive" ? "italic" : "normal",
          }}
        >
          {text}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("w-full h-full pointer-events-none", className)}
      {...motionProps}
    >
      <img
        src={src}
        alt="Signature"
        className="w-full h-full object-contain bg-background/90 rounded"
        draggable={false}
      />
    </motion.div>
  );
}
