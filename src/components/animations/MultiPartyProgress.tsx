"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticSuccess } from "@/lib/haptics";
import type { SigningParticipant } from "@/lib/multiPartySigning";

/**
 * MultiPartyProgress — Phase 9 of premium-animations.
 *
 * A horizontal sequence of circular avatars (one per signer) connected by
 * line segments that fill in as each signer completes. The "next" pending
 * signer glows softly, drawing the user's eye to who's up next.
 *
 * Sequence per sign event:
 *   1. The signing user's progress ring fills (400ms easeInOut)
 *   2. The line segment to the next avatar animates width 0→100% (350ms, 200ms delay)
 *   3. A subtle bounce on the just-filled avatar (built into ring transition)
 *   4. The next signer's avatar begins pulsing (the "active" glow)
 *   5. `hapticSuccess()` fires once per newly-signed participant
 *
 * Respects `prefers-reduced-motion`: in reduced-motion mode the rings/lines
 * jump directly to their final state with no animation, and the active glow
 * is shown as a static ring instead of pulsing.
 */
export interface MultiPartyProgressProps {
  participants: SigningParticipant[];
  /** ID of the participant currently active (whose turn it is). */
  currentRecipientId?: string;
  className?: string;
  /** Compact mode for small surfaces (e.g. inside the recipient bar). */
  compact?: boolean;
}

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 94.25

function getInitials(name: string, email: string): string {
  const source = name?.trim() || email || "";
  if (!source) return "?";
  // Split on whitespace, take first letter of up to 2 words
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // Single word: first 2 letters
  return source.slice(0, 2).toUpperCase();
}

export function MultiPartyProgress({
  participants,
  currentRecipientId,
  className,
  compact = false,
}: MultiPartyProgressProps) {
  const reduceMotion = useReducedMotion();
  const lastSignedCount = React.useRef(0);
  const hasFiredInitialHaptic = React.useRef(false);

  // Compute derived values BEFORE the early return so all hooks can be
  // called unconditionally (rules of hooks).
  const signedCount = participants.filter((p) => p.status === "signed").length;
  const nextActive = participants.find(
    (p) => p.status === "pending" || p.status === "viewed",
  );

  // Fire haptic once per newly-signed participant (skip the initial render).
  React.useEffect(() => {
    if (!hasFiredInitialHaptic.current) {
      hasFiredInitialHaptic.current = true;
      lastSignedCount.current = signedCount;
      return;
    }
    if (signedCount > lastSignedCount.current) {
      hapticSuccess();
    }
    lastSignedCount.current = signedCount;
  }, [signedCount]);

  if (participants.length === 0) return null;

  const avatarSize = compact ? 32 : 48;
  const lineWidth = compact ? 24 : 40;
  const fontSize = compact ? "text-[8px]" : "text-[10px]";

  return (
    <div className={cn("w-full", className)} role="group" aria-label="Signing progress">
      <div className="flex items-center justify-center">
        {participants.map((participant, idx) => {
          const isSigned = participant.status === "signed";
          const isDeclined = participant.status === "declined";
          const isNext = nextActive?.id === participant.id;
          const isCurrent = currentRecipientId === participant.id;
          // Line connects this participant to the NEXT one. It's "filled" once
          // this participant has signed (so the line is the "you→next" arrow).
          const lineFilled = isSigned || isDeclined;

          return (
            <React.Fragment key={participant.id}>
              {/* Avatar + progress ring */}
              <div
                className="flex flex-col items-center gap-1.5 relative flex-shrink-0"
                style={{ width: avatarSize + (isNext ? 8 : 0) }}
              >
                <div
                  className="relative"
                  style={{ width: avatarSize, height: avatarSize }}
                >
                  {/* (4) Active glow for the next signer */}
                  {isNext && (
                    <motion.span
                      aria-hidden
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        inset: -4,
                        backgroundColor: participant.color + "30",
                        boxShadow: `0 0 12px ${participant.color}55`,
                      }}
                      animate={
                        reduceMotion
                          ? { opacity: 0.7 }
                          : { scale: [1, 1.18, 1], opacity: [0.45, 0.8, 0.45] }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                      }
                    />
                  )}

                  {/* SVG progress ring */}
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 36 36"
                    aria-hidden
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r={RING_RADIUS}
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="3"
                    />
                    <motion.circle
                      cx="18"
                      cy="18"
                      r={RING_RADIUS}
                      fill="none"
                      stroke={
                        isDeclined
                          ? "hsl(var(--destructive))"
                          : isSigned
                            ? "hsl(var(--success))"
                            : participant.color
                      }
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      initial={false}
                      animate={{
                        strokeDashoffset: isSigned || isDeclined ? 0 : RING_CIRCUMFERENCE,
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: 0.4, ease: "easeInOut" }
                      }
                    />
                  </svg>

                  {/* Inner avatar */}
                  <div
                    className={cn(
                      "absolute inset-1 rounded-full flex items-center justify-center font-bold transition-colors",
                      fontSize,
                      isSigned && "bg-green-100 text-green-700",
                      isDeclined && "bg-red-100 text-red-700",
                      !isSigned && !isDeclined && isNext && "bg-background",
                      !isSigned && !isDeclined && !isNext && "bg-muted/30 text-muted-foreground",
                    )}
                    style={{
                      boxShadow: isCurrent
                        ? `0 0 0 2px ${participant.color}`
                        : isNext
                          ? `0 0 0 1.5px ${participant.color}`
                          : undefined,
                    }}
                    aria-label={`${participant.name || participant.email} (${participant.status})`}
                  >
                    {isSigned ? (
                      <Check
                        className={cn(compact ? "w-2.5 h-2.5" : "w-3.5 h-3.5")}
                        strokeWidth={3}
                      />
                    ) : isDeclined ? (
                      <X
                        className={cn(compact ? "w-2.5 h-2.5" : "w-3.5 h-3.5")}
                        strokeWidth={3}
                      />
                    ) : (
                      getInitials(participant.name, participant.email)
                    )}
                  </div>
                </div>

                {!compact && (
                  <span
                    className={cn(
                      "max-w-[64px] truncate text-center",
                      isSigned ? "text-success" : isNext ? "text-foreground" : "text-muted-foreground",
                    )}
                    style={{ fontSize: 10 }}
                  >
                    {participant.name || participant.email.split("@")[0]}
                  </span>
                )}
              </div>

              {/* Connecting line segment */}
              {idx < participants.length - 1 && (
                <div
                  className="relative flex-shrink-0 self-center"
                  style={{
                    height: 3,
                    width: lineWidth,
                  }}
                >
                  <div className="absolute inset-0 rounded-full bg-muted" />
                  <motion.div
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background: isSigned
                        ? "hsl(var(--success))"
                        : `linear-gradient(90deg, ${participant.color}, ${participants[idx + 1].color})`,
                    }}
                    initial={false}
                    animate={{ width: lineFilled ? "100%" : "0%" }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            duration: 0.35,
                            delay: lineFilled ? 0.2 : 0,
                            ease: "easeOut",
                          }
                    }
                  />
                  {/* Hide the line completely if neither side is signed and
                      it's just decoration — but keep it visible as a "track"
                      so users see the structure. */}
                  {!previousSigned && !lineFilled && (
                    <div className="absolute inset-0 rounded-full bg-muted-foreground/20" />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-3 text-center text-[11px] text-muted-foreground">
          {signedCount} of {participants.length} signed
          {nextActive && (
            <>
              {" "}·{" "}
              <span style={{ color: nextActive.color }} className="font-medium">
                {nextActive.name || nextActive.email.split("@")[0]} is up next
              </span>
            </>
          )}
          {signedCount === participants.length && (
            <span className="ml-1 text-success font-medium">· All done ✨</span>
          )}
        </div>
      )}
    </div>
  );
}
