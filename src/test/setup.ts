/**
 * Vitest global setup.
 *
 *  - Imports `@testing-library/jest-dom` matchers for expect(...).toBeInTheDocument() etc.
 *  - Polyfills IndexedDB and structuredClone so the few storage-layer tests
 *    can run in the jsdom-like happy-dom environment.
 *  - Polyfills a Web Crypto `subtle.digest` if the Node runtime version < 19.
 *
 * Loaded via `test.setupFiles` in vite.config.ts.
 */
import "@testing-library/jest-dom/vitest";

// `fake-indexeddb` provides a complete in-memory IndexedDB implementation
// usable from Node. It implements the IDBFactory interface that the app's
// `src/lib/storage.ts` reaches into via global `indexedDB`.
import "fake-indexeddb/auto";

import { webcrypto } from "node:crypto";

// crypto.subtle.digest is required by `hashDocument` (src/lib/auditTrail.ts).
// jsdom does not provide it; happy-dom provides it natively on Node ≥ 19.
// We assign only if missing, so we don't override a real implementation.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
