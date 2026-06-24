/**
 * Phase 1 P1.5 — Opt-in PostHog bootstrap.
 *
 * This file is loaded *conditionally* from AppInit when env vars are set.
 * The dynamic `import("posthog-js")` will fail at runtime if the package
 * isn't installed, but bootstrap is a no-op when env vars are unset —
 * meaning the build does NOT need to resolve posthog-js in the default
 * configuration. Only deployments that opt in must install it.
 *
 * Once the bootstrap succeeds (PostHog is initialized and registered as
 * the telemetry provider), `booted` is set to true so subsequent calls
 * (e.g. React 18 StrictMode double-mount in dev) are no-ops.
 */
import { registerTelemetryProvider, type TelemetryProvider } from "./telemetry";

const env = (typeof import.meta !== "undefined" ? (import.meta as ImportMeta).env : undefined) ?? {};

/**
 * Read an env flag with permissive truthy parsing. Accepts:
 *   - "true" / "false" (mixed case, with optional whitespace)
 *   - "1"  / "0"
 *   - "yes" / "no"
 */
function envFlag(name: string): boolean {
  const raw = ((env as Record<string, string | undefined>)[name] ?? "").toLowerCase().trim();
  return raw === "true" || raw === "1" || raw === "yes";
}

const ENABLED = envFlag("VITE_TELEMETRY_ENABLED");
const KEY = ((env as Record<string, string | undefined>).VITE_TELEMETRY_KEY ?? "") as string;
const HOST = ((env as Record<string, string | undefined>).VITE_TELEMETRY_HOST ?? "") as string;

let booted = false;

/**
 * Returns true if telemetry was successfully bootstrapped. Calling
 * bootstrap unconditionally is safe — it's a no-op when not enabled
 * AND a no-op when already booted (StrictMode / re-mount safe).
 */
export async function bootstrapTelemetry(): Promise<boolean> {
  if (booted) return true;
  if (!ENABLED || !KEY) return false;
  try {
    // PosthogJs is an optional dependency. We import it lazily so that
    // projects which never enable telemetry don't pay any build cost.
    // The ambient module declaration in `src/types/posthog-js.d.ts`
    // keeps TS happy even when the package is not installed locally.
    const mod: { default?: { init: (k: string, o?: object) => void; identify: (u: string, p?: Record<string, unknown>) => void; capture: (n: string, p?: Record<string, unknown>) => void; reset: () => void } } = await import(/* @vite-ignore */ "posthog-js");
    const posthog = mod.default;
    if (!posthog) return false;
    const opts = HOST ? { api_host: HOST } : {};
    posthog.init(KEY, opts);

    const provider: TelemetryProvider = {
      identify: (userId, props) => posthog.identify(userId, props),
      track: (name, props) => posthog.capture(name, props),
      reset: () => posthog.reset(),
    };
    registerTelemetryProvider(provider);
    booted = true;
    return true;
  } catch (err) {
    // Surface in dev but don't disrupt production.
    if (ENABLED) {
      // eslint-disable-next-line no-console
      console.warn("[SignDocu] PostHog telemetry unavailable:", err);
    }
    return false;
  }
}

// Test-only hook: re-arm bootstrap so the next call actually re-runs.
// Useful if a test wants to swap providers between providers.
export function __resetBootstrapForTests(): void {
  booted = false;
}
