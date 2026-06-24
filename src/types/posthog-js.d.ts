/**
 * Phase 1 P1.5 — Ambient module declaration for the optional `posthog-js`
 * dependency.
 *
 * `bootstrapTelemetry.ts` does `await import("posthog-js")` lazily, gated on
 * env vars so the build does not need to resolve the package in default
 * configuration. Without this declaration, TypeScript would error in the
 * typecheck step ("Cannot find module 'posthog-js'") even though the
 * runtime path is unreachable in default builds.
 *
 * Keep this declaration narrowly typed — only the methods we actually
 * use. Drop entries here if bootstrapTelemetry's API changes.
 */
declare module "posthog-js" {
  interface PosthogJsInstance {
    init(apiKey: string, options?: { api_host?: string }): void;
    identify(distinctId: string, properties?: Record<string, unknown>): void;
    capture(eventName: string, properties?: Record<string, unknown>): void;
    reset(): void;
  }
  const posthog: PosthogJsInstance;
  export default posthog;
}
