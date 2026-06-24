import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TriangleAlert, RefreshCw } from "lucide-react";
import { track } from "@/lib/telemetry";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback override; default uses a tappable recovery card */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Label used for telemetry + scope of error */
  scope?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Phase 1 P1.2 — Error boundary used to scope render-time crashes to the
 * component (or route) they originated in, instead of taking down the whole
 * app.
 *
 * Strategy:
 *   - route-level boundaries in `App.tsx` (one per page) so a crash in
 *     `/history` doesn't break `/` or `/login`
 *   - component-level boundaries can wrap tall custom animation trees
 *     (`InkedSignature`, `SuccessBurst`, etc.) when shipped
 *
 * Telemetry: the error is forwarded to `track('app_error', …)` so the team
 * sees real-world crashes in the dashboard (when telemetry is enabled).
 *
 * The boundary intentionally does NOT swallow errors silently: a recovery
 * button is always rendered.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    // Fire-and-forget telemetry. If telemetry is disabled, this is a no-op.
    try {
      track("app_error", {
        scope: this.props.scope ?? "unknown",
        message: error.message,
        name: error.name,
        componentStack: info.componentStack?.slice(0, 500) ?? "",
      });
    } catch {
      // Swallow — telemetry must never throw.
    }
    // Best-effort console surface for devs.
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", this.props.scope ?? "unknown", error);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error!, this.reset);
    }

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 p-6 m-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-center min-h-[200px]"
      >
        <TriangleAlert className="w-8 h-8 text-destructive" aria-hidden />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {this.props.scope ? `The ${this.props.scope} view crashed.` : "This view crashed."} Your work is safe.
          </p>
        </div>
        {this.state.error && (
          <pre className="text-[10px] text-muted-foreground/70 bg-muted/40 rounded-lg p-2 max-w-full overflow-auto max-h-24 text-left">
            {this.state.error.message}
          </pre>
        )}
        <Button onClick={this.reset} size="sm" className="rounded-xl">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Try again
        </Button>
      </div>
    );
  }
}

/**
 * Hook-style install helper for global uncaught errors + unhandled promise
 * rejections. Pipe through sonner once, deduplicated by message+location so
 * the user has a single visible "Something went wrong" toast rather than a
 * stack of identical ones.
 *
 * Dedup key includes filename + line number so two unrelated crashes with
 * the same message text are not collapsed into a single suppressed toast.
 *
 * Use once at the application root (App.tsx). The Set has no TTL — for
 * long-running sessions it grows but stays bounded by total crash count.
 */
export function installGlobalErrorToasts(toast: (msg: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const seen = new Set<string>();

  const onError = (event: ErrorEvent) => {
    const file = event.filename ?? "?";
    const line = event.lineno ?? 0;
    const msg = event.message || event.error?.message || "Unknown error";
    const key = `${msg}|${file}|${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    toast(`Unexpected error: ${msg}`);
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === "string" ? reason : "Unknown rejection");
    const key = `rejection|${msg}`;
    if (seen.has(key)) return;
    seen.add(key);
    toast(`Background task failed: ${msg}`);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
