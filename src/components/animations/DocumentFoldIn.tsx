"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * DocumentFoldIn — Phase 8 of premium-animations.
 *
 * Wraps the document viewer content in a one-shot "paper landing on a desk"
 * animation: it scales 0.95→1.0, rises from y+40, flattens from rotateX 8°,
 * and fades in over ~450ms (spring stiffness 180, damping 22, mass 0.7).
 *
 * The animation fires on initial mount of the wrapper, and re-fires whenever
 * the `fileKey` prop changes (so opening a new document replays the fold).
 *
 * Respects `prefers-reduced-motion`: in reduced-motion mode the wrapper is
 * a plain `div` with no animation.
 */
export interface DocumentFoldInProps {
  /**
   * Stable identity of the file being displayed. When it changes, the
   * wrapper re-mounts and the fold-in plays again. Pass something like
   * `${file.name}-${file.size}-${file.lastModified}`.
   */
  fileKey: string;
  children: React.ReactNode;
  className?: string;
}

export function DocumentFoldIn({ fileKey, children, className }: DocumentFoldInProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      key={fileKey}
      className={className}
      // Paper landing on a desk
      initial={{ scale: 0.95, y: 40, rotateX: 8, opacity: 0 }}
      animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 180,
        damping: 22,
        mass: 0.7,
        // Opacity is a separate non-spring tween for a smoother fade-in
        opacity: { duration: 0.3, ease: "easeOut" },
      }}
      style={{
        transformPerspective: 1000,
        transformOrigin: "center bottom",
        // GPU hint — avoids layout thrash on low-end Android
        willChange: "transform, opacity",
      }}
    >
      {children}
    </motion.div>
  );
}
