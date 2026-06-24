import { describe, it, expect, beforeEach } from "vitest";
import { getItem, setItem, removeItem, getKeysByPrefix, clearPrefix } from "@/lib/storage";

describe("storage wrapper (IndexedDB + localStorage hybrid)", () => {
  beforeEach(async () => {
    await clearPrefix("test-");
    // Wipe localStorage for any keys we may have touched.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("idx_test-")) {
        window.localStorage.removeItem(key);
      }
    }
  });

  it("round-trips a small object via localStorage path", async () => {
    const sample = { name: "John", age: 30, active: true };
    await setItem("test-1", sample);
    const out = await getItem<typeof sample>("test-1");
    expect(out).toEqual(sample);
  });

  it("round-trips a string", async () => {
    await setItem("test-str", "hello world");
    expect(await getItem<string>("test-str")).toBe("hello world");
  });

  it("returns null for missing keys", async () => {
    expect(await getItem("test-missing")).toBeNull();
  });

  it("removes a key from both stores", async () => {
    await setItem("test-remove", { v: 1 });
    await removeItem("test-remove");
    expect(await getItem("test-remove")).toBeNull();
  });

  it("getKeysByPrefix returns matching keys", async () => {
    await setItem("test-a", 1);
    await setItem("test-b", 2);
    await setItem("other", 3);
    const keys = await getKeysByPrefix("test-");
    expect(keys.sort()).toEqual(["test-a", "test-b"]);
  });

  it("falls back across localStorage and IndexedDB transparently", async () => {
    // Set then read; modify then read.
    await setItem("test-toggle", { x: 1 });
    expect(await getItem("test-toggle")).toEqual({ x: 1 });
    await setItem("test-toggle", { x: 2 });
    expect(await getItem("test-toggle")).toEqual({ x: 2 });
  });
});
