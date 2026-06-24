/**
 * Phase 1 P1.5 — Telemetry adapter (pluggable provider design).
 *
 * Exposes `track(name, props)`, `identify(userId, props)`, `reset()` and a
 * dead-simple `registerTelemetryProvider(p)` slot. By default no events go
 * anywhere; opt-in to PostHog, Plausible, Segment, or anything else by
 * registering a provider at boot.
 *
 * Why pluggable rather than hardcoded PostHog:
 *   - No build-time dependency on `posthog-js` (which would otherwise need
 *     to be installed even for users who never enable telemetry).
 *   - Keeps the production bundle slim: when no provider is registered,
 *     `track()` is two no-op branches.
 *   - Trivially mockable from tests via `registerTelemetryProvider(mock)`.
 *
 * Bootstrap helper: `src/lib/bootstrapTelemetry.ts` (separate file) wires
 * up a PostHog provider when `VITE_TELEMETRY_ENABLED=true` (or "1") and a
 * key is set. The bootstrap is optional — `App.tsx` imports it dynamically
 * so without the env vars, no PostHog code ever loads.
 *
 * Telemetry NEVER throws. Callers can use fire-and-forget during error
 * paths.
 */

type TelemetryProps = Record<string, string | number | boolean | null | undefined>;

export interface TelemetryProvider {
  identify(userId: string, props?: TelemetryProps): void;
  track(name: string, props?: TelemetryProps): void;
  reset(): void;
}

let provider: TelemetryProvider | null = null;

/**
 * Register a provider. Subsequent `track/identify/reset` calls delegate to
 * it. Returns a teardown function that un-registers — useful in tests.
 */
export function registerTelemetryProvider(p: TelemetryProvider | null): () => void {
  provider = p;
  return () => {
    if (provider === p) provider = null;
  };
}

/**
 * Identify a user. No-op without a registered provider. Swallows errors so
 * telemetry never crashes callers.
 */
export function identify(userId: string, props?: TelemetryProps): void {
  if (!userId || !provider) return;
  try {
    provider.identify(userId, props);
  } catch {
    /* swallow */
  }
}

/**
 * Track an event. No-op without a registered provider.
 */
export function track(name: string, props?: TelemetryProps): void {
  if (!name || !provider) return;
  try {
    provider.track(name, props);
  } catch {
    /* swallow */
  }
}

/**
 * Reset session state (called on sign-out).
 */
export function reset(): void {
  if (!provider) return;
  try {
    provider.reset();
  } catch {
    /* swallow */
  }
}

/**
 * Test-only flag indicating whether telemetry is currently wired up.
 */
export function __isTelemetryEnabled(): boolean {
  return provider !== null;
}
