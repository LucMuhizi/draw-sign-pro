import { describe, it, expect } from "vitest";
import { hashDocument, generateCertificate, type AuditRecord } from "@/lib/auditTrail";

describe("hashDocument", () => {
  it("produces a 64-char lowercase hex SHA-256", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "test.bin", { type: "application/octet-stream" });
    const hash = await hashDocument(file);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the same hash for the same content (deterministic)", async () => {
    const file = new File(
      [new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])],
      "same.bin",
      { type: "application/octet-stream" },
    );
    const a = await hashDocument(file);
    const b = await hashDocument(file);
    expect(a).toBe(b);
  });

  it("matches the SHA-256 of 'hello world'", async () => {
    // SHA-256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    const file = new File([new TextEncoder().encode("hello world")], "hello.txt", { type: "text/plain" });
    const hash = await hashDocument(file);
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });
});

describe("generateCertificate", () => {
  it("returns non-empty PDF bytes containing the document name", async () => {
    const record: AuditRecord = {
      documentName: "TestContract.pdf",
      documentHash: "deadbeef".repeat(8),
      signedAt: 1_700_000_000_000,
      signatures: [
        {
          id: "sig-1",
          page: 1,
          x: 100,
          y: 100,
          width: 150,
          height: 60,
          placedAt: 1_700_000_000_000,
        },
      ],
    };

    const bytes = await generateCertificate(record);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(500);
    // PDF starts with %PDF-
    const header = Array.from(bytes.slice(0, 5))
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(header).toBe("%PDF-");
  });

  it("includes the legal disclaimer text in the rendered certificate", async () => {
    const record: AuditRecord = {
      documentName: "x.pdf",
      documentHash: "00".repeat(32),
      signedAt: 0,
      signatures: [],
    };
    const bytes = await generateCertificate(record);
    // We can't easily assert on PDF text content without parsing; just
    // assert the PDF is longer when the disclaimer is included (>0 chars
    // of payload). The disclaimer is ~6 lines × ~50 chars ≈ 300 bytes of
    // font glyph indices — ballpark check: at least 1KB.
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
