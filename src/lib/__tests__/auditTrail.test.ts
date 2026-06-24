import { describe, it, expect } from "vitest";
import {
  summarizeSignatureSession,
  copyPayload,
  type SignatureSummary,
} from "../auditTrail";

const FIXED_TS = 1_725_000_000_000; // 2024-08-29 — fixed to make assertions deterministic

describe("summarizeSignatureSession", () => {
  it("returns zero signers when no participants and no active user", () => {
    const summary = summarizeSignatureSession({
      documentName: "blank.pdf",
      documentHash: "abc123",
      signedAt: FIXED_TS,
      placements: [],
    });
    expect(summary.signers).toHaveLength(0);
    expect(summary.placements.totalFields).toBe(0);
    expect(summary.placements.perPage).toEqual({});
  });

  it("falls back to active-user as 'owner' when no participants given", () => {
    const summary = summarizeSignatureSession({
      documentName: "nda.pdf",
      documentHash: "deadbeef",
      signedAt: FIXED_TS,
      activeUser: { id: "u1", email: "alice@example.com" },
      placements: [
        { page: 1 },
        { page: 2 },
        { page: 2 },
      ],
    });
    expect(summary.signers).toHaveLength(1);
    expect(summary.signers[0]).toMatchObject({
      id: "u1",
      email: "alice@example.com",
      role: "owner",
    });
    expect(summary.placements.totalFields).toBe(3);
    expect(summary.placements.perPage).toEqual({ 1: 1, 2: 2 });
    // Solo mode attributes every placement to the active user, so the
    // owner signer gets `placementsCount = totalFields` and therefore
    // counts as a contributor. (Multi-party without recipientId tagging
    // is the case where signersContributed is 0 — see the dedicated
    // solo-vs-multiparty describes below.)
    expect(summary.placements.signersContributed).toBe(1);
  });

  it("includes every participant with default 'signer' role", () => {
    const summary = summarizeSignatureSession({
      documentName: "lease.pdf",
      documentHash: "feedface",
      signedAt: FIXED_TS,
      participants: [
        { id: "p1", email: "bob@example.com", name: "Bob", role: "signer", signedAt: FIXED_TS + 1000 },
        { id: "p2", email: "carol@example.com", role: "witness" },
      ],
      placements: [{ page: 1, recipientId: "p1" }, { page: 1, recipientId: "p2" }],
    });
    expect(summary.signers).toHaveLength(2);
    expect(summary.signers.map((s) => s.role)).toEqual(["signer", "witness"]);
    expect(summary.placements.signersContributed).toBe(2);
  });

  it("counts unique contributors regardless of placement count", () => {
    const summary = summarizeSignatureSession({
      documentName: "doc.pdf",
      documentHash: "0",
      signedAt: FIXED_TS,
      participants: [{ id: "p1", email: "x@x", role: "signer" }],
      placements: [
        { page: 1, recipientId: "p1" },
        { page: 1, recipientId: "p1" },
        { page: 2, recipientId: "p1" },
        { page: 2, recipientId: "p1" },
      ],
    });
    expect(summary.placements.totalFields).toBe(4);
    expect(summary.placements.signersContributed).toBe(1);
    expect(summary.placements.perPage).toEqual({ 1: 2, 2: 2 });
  });

  it("initialises outputHash to empty string (caller fills it after re-hash)", () => {
    const summary = summarizeSignatureSession({
      documentName: "doc.pdf",
      documentHash: "input-hash",
      signedAt: FIXED_TS,
      activeUser: { id: "u1", email: "u@u" },
      placements: [],
    });
    expect(summary.outputHash).toBe("");
    expect(summary.documentHash).toBe("input-hash");
  });
});

describe("copyPayload", () => {
  const summary: SignatureSummary = {
    documentName: "report.pdf",
    documentHash: "abcd1234",
    outputHash: "efgh5678",
    signedAt: FIXED_TS,
    signers: [
      { id: "u1", email: "alice@example.com", name: "Alice", role: "owner", signedAt: FIXED_TS, placementsCount: 3 },
      { id: "p1", email: "bob@example.com", role: "signer", signedAt: FIXED_TS + 1000, placementsCount: 0 },
    ],
    placements: { signersContributed: 1, totalFields: 3, perPage: { 1: 2, 2: 1 } },
  };

  it("contains the document name and SHA-256 hashes", () => {
    const txt = copyPayload(summary);
    expect(txt).toContain("Document: report.pdf");
    expect(txt).toContain("Input SHA-256:");
    expect(txt).toContain("abcd1234");
    expect(txt).toContain("efgh5678");
  });

  it("lists every signer with role + email", () => {
    const txt = copyPayload(summary);
    expect(txt).toContain("Signers (2):");
    expect(txt).toContain("alice@example.com");
    expect(txt).toContain("bob@example.com");
  });

  it("summarises per-page field counts in stable page order", () => {
    const txt = copyPayload(summary);
    expect(txt).toContain("3 across 2 page(s)");
    // page 1 before page 2 in output
    expect(txt.indexOf("Page 1:")).toBeLessThan(txt.indexOf("Page 2:"));
  });

  it("includes per-signer placementsCount on each row", () => {
    const txt = copyPayload(summary);
    expect(txt).toContain("alice@example.com");
    // Locate alice's row and assert it carries `field(s)` along with the
    // expected count. We split on newline first so the check anchors on
    // this row only and doesn't risk picking up digits embedded in the
    // formatted timestamp (e.g. "8/29/2024") earlier on the same line.
    const aliceLine = txt.split("\n").find((l) => l.includes("alice@example.com"));
    expect(aliceLine).toBeDefined();
    expect(aliceLine).toContain("3 field(s)");
  });
});

describe("normaliseSignerRole", () => {
  it("maps `sender` to receipt `owner`", async () => {
    const { normaliseSignerRole } = await import("../auditTrail");
    expect(normaliseSignerRole("sender")).toBe("owner");
  });

  it("maps `viewer` to receipt `cc`", async () => {
    const { normaliseSignerRole } = await import("../auditTrail");
    expect(normaliseSignerRole("viewer")).toBe("cc");
  });

  it("passes through `witness` and `owner`", async () => {
    const { normaliseSignerRole } = await import("../auditTrail");
    expect(normaliseSignerRole("witness")).toBe("witness");
    expect(normaliseSignerRole("owner")).toBe("owner");
  });

  it("defaults to `signer` for missing or unknown input", async () => {
    const { normaliseSignerRole } = await import("../auditTrail");
    expect(normaliseSignerRole(undefined)).toBe("signer");
    // The TypeScript union prevents literal "garbage" from compiling,
    // so we only verify the two runtime possibilities: undefined / signer.
    expect(normaliseSignerRole("signer")).toBe("signer");
  });
});

describe("summarizeSignatureSession — placementsCount attribution", () => {
  it("solo user gets credit for every placement when none are tagged", async () => {
    const { summarizeSignatureSession } = await import("../auditTrail");
    const summary = summarizeSignatureSession({
      documentName: "solo.pdf",
      documentHash: "x",
      signedAt: FIXED_TS,
      activeUser: { id: "u1", email: "u@u" },
      placements: [
        { page: 1 },
        { page: 1 },
        { page: 3 },
      ],
    });
    expect(summary.signers).toHaveLength(1);
    expect(summary.signers[0].placementsCount).toBe(3);
    expect(summary.placements.signersContributed).toBe(1);
  });

  it("multi-party assigns per-recipient counts from placement recipientIds", async () => {
    const { summarizeSignatureSession } = await import("../auditTrail");
    const summary = summarizeSignatureSession({
      documentName: "multi.pdf",
      documentHash: "x",
      signedAt: FIXED_TS,
      participants: [
        { id: "p1", email: "a@a", role: "signer" },
        { id: "p2", email: "b@b", role: "signer" },
      ],
      placements: [
        { page: 1, recipientId: "p1" },
        { page: 1, recipientId: "p1" },
        { page: 1, recipientId: "p2" },
        { page: 2, recipientId: "p2" },
      ],
    });
    const p1 = summary.signers.find((s) => s.id === "p1");
    const p2 = summary.signers.find((s) => s.id === "p2");
    expect(p1?.placementsCount).toBe(2);
    expect(p2?.placementsCount).toBe(2);
    expect(summary.placements.signersContributed).toBe(2);
  });

  it("uses zero for participants whose recipientId never appears", async () => {
    const { summarizeSignatureSession } = await import("../auditTrail");
    const summary = summarizeSignatureSession({
      documentName: "partial.pdf",
      documentHash: "x",
      signedAt: FIXED_TS,
      participants: [
        { id: "p1", email: "a@a", role: "signer" },
        { id: "p2", email: "b@b", role: "signer" },
        { id: "p3", email: "c@c", role: "signer" },
      ],
      placements: [{ page: 1, recipientId: "p1" }],
    });
    expect(summary.placements.signersContributed).toBe(1);
    expect(summary.signers.find((s) => s.id === "p3")?.placementsCount).toBe(0);
  });
});

describe("hashBytes", () => {
  it("produces a 64-char lowercase hex SHA-256", async () => {
    const { hashBytes } = await import("../auditTrail");
    const hash = await hashBytes(new TextEncoder().encode("hello world"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "hello world"
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("treats empty input as the canonical empty-input hash", async () => {
    const { hashBytes } = await import("../auditTrail");
    const hash = await hashBytes(new Uint8Array(0));
    // SHA-256 of the empty string
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
