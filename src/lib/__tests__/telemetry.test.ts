import { describe, it, expect, beforeEach } from "vitest";
import { identify, track, reset, registerTelemetryProvider, __isTelemetryEnabled } from "@/lib/telemetry";

interface Call {
  fn: "identify" | "track" | "reset";
  args: unknown[];
}

function makeMockProvider() {
  const calls: Call[] = [];
  const provider = {
    identify: (userId: string, props?: unknown) => calls.push({ fn: "identify", args: [userId, props] }),
    track: (name: string, props?: unknown) => calls.push({ fn: "track", args: [name, props] }),
    reset: () => calls.push({ fn: "reset", args: [] }),
  };
  return { provider, calls };
}

describe("telemetry registry", () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    if (teardown) teardown();
    teardown = null;
    // Ensure clean state between tests.
    registerTelemetryProvider(null)();
  });

  it("is a no-op without a registered provider", () => {
    expect(__isTelemetryEnabled()).toBe(false);
    // Should not throw and should return undefined on all paths.
    expect(identify("u1")).toBeUndefined();
    expect(track("evt")).toBeUndefined();
    expect(reset()).toBeUndefined();
  });

  it("delegates track / identify / reset to the registered provider", () => {
    const { provider, calls } = makeMockProvider();
    teardown = registerTelemetryProvider(provider);
    expect(__isTelemetryEnabled()).toBe(true);

    identify("user-42", { email: "jane@example.com" });
    track("app_open", { ua: "test" });
    track("funnel_upload_started");
    reset();

    expect(calls).toEqual([
      { fn: "identify", args: ["user-42", { email: "jane@example.com" }] },
      { fn: "track", args: ["app_open", { ua: "test" }] },
      { fn: "track", args: ["funnel_upload_started", undefined] },
      { fn: "reset", args: [] },
    ]);
  });

  it("teardown returned by register un-installs the provider", () => {
    const { provider, calls } = makeMockProvider();
    const remove = registerTelemetryProvider(provider);
    expect(__isTelemetryEnabled()).toBe(true);
    remove();
    expect(__isTelemetryEnabled()).toBe(false);
    track("after-teardown");
    expect(calls).toEqual([]);
  });

  it("swallows errors thrown inside the provider", () => {
    const broken = {
      identify: () => { throw new Error("ident boom"); },
      track: () => { throw new Error("track boom"); },
      reset: () => { throw new Error("reset boom"); },
    };
    teardown = registerTelemetryProvider(broken);
    expect(() => identify("u1")).not.toThrow();
    expect(() => track("evt")).not.toThrow();
    expect(() => reset()).not.toThrow();
  });

  it("rejects empty userId / event name silently", () => {
    const { provider, calls } = makeMockProvider();
    teardown = registerTelemetryProvider(provider);
    identify("");
    track("");
    expect(calls).toEqual([]);
  });
});
