import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { SignaturePlacement, PlacementRange } from './pdfSigner';

export interface AuditRecord {
  documentName: string;
  documentHash: string;
  /**
   * One row per logical placement (not per effective stamp). For a
   * range placement, the row carries the `range` shape so the cert
   * page can render "Pages N-M" instead of misleadingly pinning it
   * to one page.
   */
  signatures: {
    id: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    range?: PlacementRange;
    placedAt: number;
  }[];
  signedAt: number;
}

/**
 * One contributor to a signing session.
 *
 * - `name` is optional so the receipt UI can show an email-only fallback
 *   when no display name is available.
 * - `role` is normalised to one of the four canonical receipt roles. The
 *   multi-party tab uses their own roles (sender/signer/viewer); the
 *   receipt collapses those into the same union so the dialog is stable.
 * - `signedAt` lets the receipt show per-signer ordering when multiple
 *   participants contributed to the same document.
 * - `placementsCount` is derived from the placements the user actually
 *   contributed (by `recipientId`). For the active-user solo path the
 *   caller assigns `totalFields` since solo mode is one user → all
 *   placements.
 */
export interface SignerEntry {
  id: string;
  email: string;
  name?: string;
  role: "owner" | "signer" | "witness" | "cc";
  signedAt: number;
  placementsCount: number;
}

/**
 * The display model for the post-download signing receipt dialog.
 *
 * `copyPayload()` produces the canonical text representation a user
 * would paste into an email or ticket so the verification wording
 * matches on every surface (PDF cert, in-app dialog, JSON download).
 */
export interface SignatureSummary {
  documentName: string;
  documentHash: string;
  /** SHA-256 hash of the OUTPUT (signed) bytes — produced after the
   *  signed PDF is generated. Empty until the post-export hash is
   *  measured; viewers should label the field accordingly. */
  outputHash: string;
  signedAt: number;
  signers: SignerEntry[];
  placements: {
    signersContributed: number;
    totalFields: number;
    perPage: Record<number, number>;
  };
}

export function copyPayload(summary: SignatureSummary): string {
  const lines: string[] = [];
  lines.push(`Document: ${summary.documentName}`);
  lines.push(`Signed at: ${new Date(summary.signedAt).toLocaleString()}  (${new Date(summary.signedAt).toISOString()})`);
  lines.push(`Input SHA-256:  ${summary.documentHash || "(not measured)"}`);
  if (summary.outputHash) {
    lines.push(`Output SHA-256: ${summary.outputHash}`);
  }
  lines.push("");
  lines.push(`Signers (${summary.signers.length}):`);
  for (const s of summary.signers) {
    const label = s.name ? `${s.name} <${s.email}>` : s.email;
    lines.push(`  - ${s.role.padEnd(8)} ${label}  @ ${new Date(s.signedAt).toLocaleString()}  ${s.placementsCount} field(s)`);
  }
  lines.push("");
  const total = summary.placements.totalFields;
  const pages = Object.keys(summary.placements.perPage).sort((a, b) => Number(a) - Number(b));
  lines.push(`Fields placed: ${total} across ${pages.length} page(s)`);
  for (const p of pages) {
    lines.push(`  Page ${p}: ${summary.placements.perPage[Number(p)]}`);
  }
  return lines.join("\n");
}

/**
 * Expand a placement into the list of page numbers on which it
 * appears in the export. Single-page → [page]. Range →
 * [startPage..endPage] inclusive. Used by the receipt perPage count
 * and any future "show on page N" queries that don't need full coords.
 *
 * Lives in auditTrail.ts because the receipt dialog is the primary
 * consumer; other modules that need this same expansion (pdfSigner,
 * SignaturePlacementLayer) inline their own equivalent to avoid a
 * circular import through both barrels.
 */
export function placementAppearsOnPages(
  placement: { page: number; range?: PlacementRange },
): number[] {
  if (placement.range) {
    const start = Math.max(1, placement.range.startPage);
    const end = Math.max(start, placement.range.endPage);
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }
  return [placement.page];
}

/**
 * Build the display model used by the post-download receipt dialog.
 *
 * Pure function — easy to unit test. The caller passes the participant
 * list (possibly empty), the active user's email/id for the "owner"
 * fallback, and the placements that were just exported. This keeps the
 * UI layer free of business logic.
 *
 * `outputHash` is optional because at construction time the signed PDF
 * hasn't been hashed yet; the caller typically threads the value in via
 * this parameter once `hashBytes(finalPdfBytes)` resolves downstream.
 * Surfacing it through the function (rather than mutating the returned
 * object) keeps the model Reactive-StrictMode-double-invoke + lint-safe.
 */
export function summarizeSignatureSession(opts: {
  documentName: string;
  documentHash: string;
  signedAt: number;
  outputHash?: string;
  participants?: Array<{
    id: string;
    email?: string;
    name?: string;
    role?: "sender" | "signer" | "viewer" | "owner" | "witness" | "cc";
    signedAt?: number;
  }>;
  /**
   * Phase 2 P2.4 — widened to accept the range field so a placement
   * spanning `[3..7]` is correctly counted on every page in that
   * span (see `placementAppearsOnPages`). The receipt's perPage map
   * drives the rendered histogram in SignedSummaryDialog.
   */
  placements: Array<{ page: number; recipientId?: string; range?: PlacementRange }>;
  /** Active user email/id — used as "owner" fallback when no
   *  participants were passed. */
  activeUser?: { id: string; email?: string };
}): SignatureSummary {
  const placements = opts.placements;
  const perPage: Record<number, number> = {};
  for (const p of placements) {
    // Phase 2 P2.4 — a range placement counts on every page in its
    // span, so perPage reflects the EFFECTIVE field count the user
    // will see on each page of the signed PDF. `totalFields` below
    // still tracks logical placement count (1 range = 1 placement).
    for (const pageNum of placementAppearsOnPages(p)) {
      perPage[pageNum] = (perPage[pageNum] ?? 0) + 1;
    }
  }

  // Per-recipient contribution counts so each SignerEntry can show the
  // exact number of fields they placed (rather than the brittle "first N
  // listed contributed TOTAL" heuristic that the previous version used).
  // Range placements are counted once per recipient — they are one
  // logical contribution that happens to render on multiple pages.
  const contributionsByRecipient: Record<string, number> = {};
  for (const p of placements) {
    if (p.recipientId) {
      contributionsByRecipient[p.recipientId] =
        (contributionsByRecipient[p.recipientId] ?? 0) + 1;
    }
  }

  const signers: SignerEntry[] = [];

  // 1) Active-user fallback so a solo-signer always shows a row.
  //    Without this, the dialog would render "0 signers" for the
  //    common single-device case and feel empty.
  //
  //    In solo mode there are no recipientId tags on placements, so we
  //    attribute every placement to the active user — they did them all.
  if (!opts.participants || opts.participants.length === 0) {
    if (opts.activeUser?.email || opts.activeUser?.id) {
      signers.push({
        id: opts.activeUser.id,
        email: opts.activeUser.email ?? opts.activeUser.id,
        name: undefined,
        role: "owner",
        signedAt: opts.signedAt,
        placementsCount: placements.length,
      });
    }
  } else {
    // 2) Multi-party list. We map each participant's multi-party role
    //    (`sender` / `signer` / `viewer`) onto the receipt's canonical
    //    role union. `sender` → "owner", `signer` → "signer",
    //    `viewer` → "cc". External "owner"/"witness"/"cc" pass through.
    for (const p of opts.participants) {
      signers.push({
        id: p.id,
        email: p.email ?? p.id,
        name: p.name,
        role: normaliseSignerRole(p.role),
        signedAt: p.signedAt ?? opts.signedAt,
        placementsCount: contributionsByRecipient[p.id] ?? 0,
      });
    }
  }

  // Derived stat: how many distinct signers actually contributed at
  // least one placement. Powers the "X of Y signed" line.
  const signersContributed = signers.filter((s) => s.placementsCount > 0).length;

  return {
    documentName: opts.documentName,
    documentHash: opts.documentHash,
    outputHash: opts.outputHash ?? "",
    signedAt: opts.signedAt,
    signers,
    placements: {
      signersContributed,
      totalFields: placements.length,
      perPage,
    },
  };
}

/**
 * Map a multi-party signing role onto the receipt's canonical role
 * union. Centralised so the dialog and the test fixture agree.
 */
export function normaliseSignerRole(
  role: "sender" | "signer" | "viewer" | "owner" | "witness" | "cc" | undefined,
): SignerEntry["role"] {
  switch (role) {
    case "sender":
      return "owner";
    case "witness":
      return "witness";
    case "viewer":
      return "cc";
    case "owner":
      return "owner";
    case "cc":
      return "cc";
    case "signer":
    default:
      return "signer";
  }
}

export async function hashDocument(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash any byte buffer. Used for the *output* SHA-256 that gets shown
 * on the receipt — i.e. the fingerprint of the signed PDF the user
 * actually downloaded. Distinct from `hashDocument(file)` since the
 * output arrives as `Uint8Array`, not `File`.
 *
 * Reused by `downloadSignedDocument` so we avoid double-hashing the
 * input bytes via this lib + the documentActions internal hash.
 */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  // `crypto.subtle.digest` accepts either an ArrayBuffer or a typed
  // array backed by an ArrayBuffer. Slice the view's underlying buffer
  // just to satisfy strict TS without reallocating.
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface DownloadResult {
  fileName: string;
  /** SHA-256 of the *input* (unsigned) bytes, included here so the
   *  receipt and the cert use one value rather than two callsites
   *  hashing the same file independently. */
  inputHash: string;
  /** SHA-256 of the *output* bytes the user will download. Empty when
   *  measurement failed (treated as "not measured" in the receipt UI). */
  outputHash?: string;
}

export async function generateCertificate(record: AuditRecord): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  const drawText = (text: string, size: number, bold = false, x = margin) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= size + 6;
  };

  const drawLine = () => {
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 12;
  };

  drawText('Certificate of Completion', 24, true);
  drawLine();

  drawText('This document has been electronically signed.', 11);
  y -= 4;

  drawText('Document', 14, true);
  drawText(`Name: ${record.documentName}`, 10);
  drawText(`SHA-256: ${record.documentHash}`, 8);
  drawText(`Signed: ${new Date(record.signedAt).toLocaleString()}`, 10);
  drawLine();

  drawText('Signatures', 14, true);
  for (let i = 0; i < record.signatures.length; i++) {
    const s = record.signatures[i];
    // Phase 2 P2.4 — range placements print "Page N" (their anchor)
    // followed by how many pages they cover, so the cert reads
    // "Page 3 (×5 pages)" rather than hiding the multi-page span.
    const isRange = !!s.range;
    const pageLabel = isRange
      ? `Pages ${s.range?.startPage}-${s.range?.endPage}`
      : `Page ${s.page}`;
    const coverage = isRange
      ? `  (${(s.range?.endPage ?? 0) - (s.range?.startPage ?? 0) + 1} pages)`
      : "";
    drawText(
      `#${i + 1} — ${pageLabel}${coverage} at (${Math.round(s.x)}, ${Math.round(s.y)})`,
      isRange ? 9 : 10,
    );
    drawText(`  Placed at: ${new Date(s.placedAt).toLocaleString()}`, 9);
  }
  drawLine();

  drawText('This certificate provides a verifiable record of the', 9);
  drawText('signing event. Any modification to the document after', 9);
  drawText('signing will invalidate the document hash.', 9);
  y -= 6;
  drawText('IMPORTANT LEGAL NOTICE:', 10, true);
  drawText('This certificate does NOT constitute a legally binding', 9);
  drawText('digital signature under eIDAS, ESIGN Act, or UETA.', 9);
  drawText('For legally binding electronic signatures, use a', 9);
  drawText('qualified trust service provider (e.g., DocuSign,', 9);
  drawText('Adobe Sign, or an eIDAS-certified provider).', 9);

  return await pdfDoc.save();
}

export async function appendCertificateToDocument(
  pdfBytes: Uint8Array,
  certificateBytes: Uint8Array,
): Promise<Uint8Array> {
  const mainPdf = await PDFDocument.load(pdfBytes);
  const certPdf = await PDFDocument.load(certificateBytes);

  const certPages = await mainPdf.copyPages(certPdf, [0]);
  certPages.forEach(p => mainPdf.addPage(p));

  return await mainPdf.save();
}
