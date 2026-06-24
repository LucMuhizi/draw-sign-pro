/**
 * Skeleton loading primitives with shimmer animation.
 * Zero JS overhead — pure CSS (see `.skeleton-shimmer` in index.css).
 *
 * P3b: the base class swaps Tailwind's `animate-pulse` (which hard-steps
 * opacity) for a horizontal sweep that visually feels closer to native
 * iOS / Android loading states. The gradient overlays the `bg-muted/60`
 * tinted base, so the silhouette is still readable while loading.
 */
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /**
   * Inline style. Primarily used by SkeletonCircle / SkeletonCard /
   * SkeletonDocumentPage for numeric sizing (width, height) that
   * Tailwind's static classes can't express. Note: inline styles
   * and Tailwind className don't 'merge' — for most CSS properties
   * the inline declaration takes precedence over the className rule
   * so callers should treat them as a layering choice, not a
   * composition step.
   */
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-lg bg-muted/60",
        className,
      )}
      style={style}
    />
  );
}

/** A block of text skeleton lines. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

/** A card-shaped skeleton. */
export function SkeletonCard({
  className,
  height = 120,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/50 p-5 space-y-3",
        className,
      )}
    >
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton style={{ height }} className="mt-3 rounded-lg" />
    </div>
  );
}

/** A circular skeleton (avatar, icon placeholder). */
export function SkeletonCircle({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn("rounded-full", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** A document page skeleton — mimics PDF viewer loading state. */
export function SkeletonDocumentPage({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/30 p-8 space-y-4 flex flex-col items-center",
        className,
      )}
    >
      <Skeleton className="h-6 w-48" />
      <Skeleton style={{ width: "100%", maxWidth: 600, height: 400 }} className="rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** A list item skeleton for history/record views. */
export function SkeletonListItem({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-5 rounded-xl border border-border/50 bg-card/50",
        className,
      )}
    >
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg ml-4" />
    </div>
  );
}
