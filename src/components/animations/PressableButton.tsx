"use client";

import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * PressableButton — Phase 1 of premium-animations plan.
 *
 * Drop-in replacement for raw `motion.button` that adds the
 * "anticipation + overshoot" press curve:
 *
 *   Press:    1.0 → 0.97      (button compresses)
 *   Release:  0.97 → 1.03 → 1 (overshoot then settle)
 *   Total:    120ms
 *
 * Compose with `whileHover` and existing variants; Framer Motion
 * automatically suspends `whileHover` while `whileTap` is active.
 *
 * Respects `prefers-reduced-motion`: when reduced motion is on,
 * the press curve collapses to a single discrete scale (no animation).
 *
 * Consumer-provided `whileHover`, `transition`, etc. are still honored for
 * hover behavior; the `whileTap` transition is always the spec value above
 * so the press curve stays consistent across the app.
 */
export type PressableButtonProps = HTMLMotionProps<"button"> & {
  className?: string;
};

const PressableButton = React.forwardRef<HTMLButtonElement, PressableButtonProps>(
  ({ className, children, disabled, ...props }, ref) => {
    // Respect OS reduced-motion: when on, the press curve collapses to a
    // single discrete value (no animation). The button still works.
    const reduceMotion = useReducedMotion();
    const tapAnimation = disabled || reduceMotion ? undefined : { scale: [1, 0.97, 1.03, 1] };
    const tapTransition = reduceMotion
      ? { duration: 0 }
      : { duration: 0.12, times: [0, 0.25, 0.5, 1], ease: "easeOut" as const };

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        className={cn("select-none", className)}
        {...props}
        whileTap={tapAnimation}
        transition={tapTransition}
      >
        {children}
      </motion.button>
    );
  },
);
PressableButton.displayName = "PressableButton";

export { PressableButton };
