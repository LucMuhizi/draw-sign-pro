"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { hapticSuccess } from "@/lib/haptics";
import { Check } from "lucide-react";

/**
 * SuccessBurst — Phase 7 of premium-animations.
 *
 * Renders a one-shot "paper dust" celebration when a document has been
 * successfully signed and downloaded/shared. The intent is *professional*,
 * not party-time: 18 tiny muted particles drift outward from a checkmark,
 * accompanied by a `hapticSuccess()` on completion.
 *
 * Sequence (total ~1.1s):
 *   1. Document thumbnail (the "from" element) scales 1.0 → 0.7 (300ms spring)
 *   2. Checkmark forms in its place (path length 0 → 1, 250ms)
 *   3. 18 paper-dust particles radiate outward (900ms, staggered)
 *   4. `hapticSuccess()` fires on complete (guarded by useRef)
 *
 * Paper dust spec (per the plan):
 *   - Count: 18
 *   - Size: 2-5px (tiny)
 *   - Colors: muted — `hsl(var(--muted-foreground))` at varying opacities
 *   - Motion: drift outward 60-100px, with slight gravity bias
 *   - Fade: opacity 1 → 0 over the duration
 *
 * Usage:
 *   <SuccessBurst trigger={isSuccess} />
 *   or
 *   <SuccessBurst active={isSuccess} onComplete={() => ...} />
 */
export interface SuccessBurstProps {
  /** When true, the burst plays. Resets on each false → true transition. */
  active: boolean;
  /** Optional callback when the burst animation finishes. */
  onComplete?: () => void;
  className?: string;
  /** Width of the burst "stage" in px. */
  width?: number;
  /** Height of the burst "stage" in px. */
  height?: number;
}

const PARTICLE_COUNT = 18;
const PARTICLE_COLORS = [
  "hsl(var(--muted-foreground) / 0.55)",
  "hsl(var(--muted-foreground) / 0.35)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.25)",
];

// Deterministic pseudo-random for SSR-stable particle layout per burst instance.
// (We reseed on each activation so each burst looks fresh.)
function makeParticles(seed: number) {
  // Mulberry32 — tiny PRNG
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + rand() * 0.4;
    const distance = 60 + rand() * 40; // 60-100px
    const size = 2 + rand() * 3; // 2-5px
    return {
      key: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance + 12, // slight downward gravity
      size,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      rotation: rand() * 180,
    };
  });
}

export function SuccessBurst({
  active,
  onComplete,
  className,
  width = 160,
  height = 160,
}: SuccessBurstProps) {
  const reduceMotion = useReducedMotion();
  const [runId, setRunId] = React.useState(0);
  const lastActive = React.useRef(active);
  const hasFiredHaptic = React.useRef(false);
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Re-seed particles on every false → true transition.
  React.useEffect(() => {
    if (active && !lastActive.current) {
      hasFiredHaptic.current = false;
      setRunId((n) => n + 1);
    }
    lastActive.current = active;
  }, [active]);

  const particles = React.useMemo(() => makeParticles(runId + 1), [runId]);

  if (reduceMotion) {
    // Reduced motion: just show the checkmark, no animation or particles.
    return (
      <AnimatePresence>
        {active && (
          <motion.div
            className={`relative flex items-center justify-center ${className ?? ""}`}
            style={{ width, height }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="status"
            aria-label="Document signed"
          >
            <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={runId}
          className={`relative flex items-center justify-center pointer-events-none ${className ?? ""}`}
          style={{ width, height }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="status"
          aria-label="Document signed"
        >
          {/* (1) Document shrinks in scale (visual proxy for "doc → dust"). */}
          <motion.div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 0.7, opacity: 0.0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="w-12 h-16 rounded-md bg-gradient-to-br from-primary/40 to-secondary/40 border border-border" />
          </motion.div>

          {/* (2) Checkmark forms in its place. */}
          <motion.div
            aria-hidden
            className="absolute flex items-center justify-center"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.25, ease: "easeOut" }}
          >
            <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-7 h-7 text-success"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.18, duration: 0.25, ease: "easeOut" }}
                />
              </svg>
            </div>
          </motion.div>

          {/* (3) Paper-dust particles. */}
          {particles.map((p, i) => (
            <motion.span
              key={`${runId}-${p.key}`}
              aria-hidden
              className="absolute rounded-sm"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                left: "50%",
                top: "50%",
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                rotate: `${p.rotation}deg`,
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
              animate={{
                x: p.x,
                y: p.y,
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1, 1, 0.6],
              }}
              transition={{
                duration: 0.9,
                delay: 0.3 + i * 0.012,
                times: [0, 0.15, 0.6, 1],
                ease: "easeOut",
              }}
              onAnimationComplete={() => {
                // Fire haptic once when the LAST particle completes.
                if (i === particles.length - 1) {
                  if (hasFiredHaptic.current) return;
                  hasFiredHaptic.current = true;
                  hapticSuccess();
                  onCompleteRef.current?.();
                }
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
