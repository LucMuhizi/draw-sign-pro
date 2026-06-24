import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatDate } from './utils';

export type FieldType = 'signature' | 'typed' | 'date' | 'initials' | 'checkbox';

/**
 * Phase 2 P2.4 — placement that spans multiple consecutive pages.
 *
 * When a `SignaturePlacement` carries a `range`, the same normalized
 * field stamp appears on every page in `[startPage..endPage]`. Coords
 * (x, y, width, height) are interpreted as ratios of each page's display
 * dimensions, **not** absolute pixel values. This is what lets a
 * single record stamp a "signature here, here, and over there" line
 * across pages with different aspect ratios without two passes of
 * scaling math at the call site.
 *
 * Range x/y are measured from the **top-left** of each page (matching
 * the screen overlay origin), so a normalized `y: 0` sits at the top
 * edge and `y: 1` at the bottom. The PDF export flips the y-axis when
 * stamping the rendered output, as it already does for single-page
 * placements.
 */
export interface PlacementRange {
  startPage: number;
  endPage: number;
}

/**
 * Returns true if a placed field has all the data it needs to render
 * into the final PDF. Used by the field-completion-pulse animation
 * (Phase 2 of premium-animations plan).
 *
 * - signature: always complete (the image is the placement)
 * - date:      always complete — `embedSignaturesIntoPDF` falls back to
 *              'MM/DD/YYYY' when `placement.dateFormat` is empty.
 * - typed:     complete when typedText is non-empty
 * - initials:  complete when typedText is non-empty
 * - checkbox:  complete when checked === true
 */
export function isFieldComplete(sig: SignaturePlacement): boolean {
  const ft: FieldType = sig.fieldType || 'signature';
  switch (ft) {
    case 'checkbox':
      return sig.checked === true;
    case 'typed':
    case 'initials':
      return !!sig.typedText && sig.typedText.trim().length > 0;
    case 'date':
      return true;
    case 'signature':
    default:
      return true;
  }
}

export interface SignaturePlacement {
  id: string;
  /**
   * Single-page placements: pixel-coords in the page-area wrapper.
   * Range placements: ratios in [0..1] of each page's display
   * dimensions (see PlacementRange for the per-page scale rule).
   */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Single-page: the page this placement sits on.
   * Range: `startPage` for back-compat / display; the actual span lives
   * in `range.endPage`.
   */
  page: number;
  /**
   * Phase 2 P2.4 — range span. When set, the placement is logically
   * present on every page in `range.startPage..range.endPage` (clipped
   * to the document's page count by the expand helpers).
   */
  range?: PlacementRange;
  /** Field type — determines how it's rendered in the final PDF */
  fieldType?: FieldType;
  /** Text content for typed/initials fields */
  typedText?: string;
  /** Font family for typed fields (used in PDF rendering) */
  fontFamily?: string;
  /** Date format string, e.g. "MM/DD/YYYY" */
  dateFormat?: string;
  /** Whether checkbox is checked */
  checked?: boolean;
  /** Recipient ID (for multi-party signing) */
  recipientId?: string;
}

/**
 * True when a placement represents a multi-page range rather than a
 * single-page marker. Centralised so the render layer, the
 * undo/redo snapshot test, and the audit-trail test fixtures all
 * agree on what counts as a "range" without sprinkling `!!p.range`
 * booleans throughout the codebase.
 */
export function isRangePlacement(p: SignaturePlacement): boolean {
  return !!p.range;
}

/**
 * A placement expanded for a specific page, with coords already
 * converted into the wrapper's pixel space for that page. The render
 * layer iterates this list and draws one overlay per entry.
 *
 * `base` carries the original record so field-type behaviour
 * (`checked`, `typedText`, `dateFormat`) keeps using the placement
 * metadata rather than denormalised copies.
 */
export interface ExpandedPlacement {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  base: SignaturePlacement;
}

/**
 * Compute the absolute wrapper-pixel coords for a single placement on
 * a specific page. Returns `null` when the placement is not active on
 * that page (single-page on a different page, or outside the page's
 * range starts/ends).
 *
 * - Single-page: returns the placement as-is at `p.page`.
 * - Range: scales normalised x/y/w/h by `(displayWidth, displayHeight)`
 *   when pageNum ∈ [start..end]. Out-of-range pages return null.
 *
 * Width/height of the page wrapper must come from the caller (in
 * practice `containerRef.current.clientWidth/Height`). Doing it here
 * keeps the layer component DOM-free.
 */
export function expandPlacementToPage(
  p: SignaturePlacement,
  pageNum: number,
  displayWidth: number,
  displayHeight: number,
): ExpandedPlacement | null {
  if (p.range) {
    if (pageNum < p.range.startPage || pageNum > p.range.endPage) return null;
    return {
      page: pageNum,
      x: p.x * displayWidth,
      y: p.y * displayHeight,
      width: p.width * displayWidth,
      height: p.height * displayHeight,
      base: p,
    };
  }
  if (p.page !== pageNum) return null;
  return {
    page: pageNum,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    base: p,
  };
}

/**
 * Materialise every (page, placement) pair the export pipeline needs
 * to stamp. For each placement:
 *   - Single-page: emits one pair at `placement.page`.
 *   - Range: emits one pair for every page in `[start..end]`, clipped
 *     to `[1..numPages]` so partial ranges at the document edges do
 *     not throw "out of bounds" errors downstream.
 *
 * The returned `placement` retains its **as-stored** coord system
 * (pixels for single, normalized for range). Callers (the PDF signer
 * especially) decide how to scale per page. This split between
 * "expand which pages" and "scale which coords" lives here so the PDF
 * signer can multiply once-per-page against `pdfDoc.getPage(i)`.
 */
export function expandPlacementsToAllPages(
  placements: SignaturePlacement[],
  numPages: number,
): { page: number; placement: SignaturePlacement }[] {
  const totalPages = Math.max(1, numPages);
  const out: { page: number; placement: SignaturePlacement }[] = [];
  for (const p of placements) {
    if (p.range) {
      const start = Math.max(1, p.range.startPage);
      const end = Math.min(totalPages, p.range.endPage);
      for (let i = start; i <= end; i++) {
        out.push({ page: i, placement: p });
      }
    } else {
      out.push({ page: p.page, placement: p });
    }
  }
  return out;
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new Uint8Array(await blob.arrayBuffer());
}

function detectImageFormat(dataUrl: string): 'png' | 'jpg' {
  if (dataUrl.startsWith('data:image/png')) return 'png';
  return 'jpg';
}

function scaleToPdf(
  value: number,
  pdfDim: number,
  renderedDim: number,
) {
  return value * (pdfDim / renderedDim);
}

export async function embedSignaturesIntoPDF(
  pdfBytes: ArrayBuffer,
  signatureDataUrl: string,
  placements: SignaturePlacement[],
  renderedPageWidth: number,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // Only embed the signature image if any placement uses it.
  // `Awaited<ReturnType<...>>` matches what `await pdfDoc.embedPng/Jpg`
  // resolves to; without `Awaited`, the variable type is `Promise<PDFImage>`
  // and assigning an awaited value (i.e. PDFImage, not Promise<PDFImage>)
  // triggers TS2739.
  let signatureImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | Awaited<ReturnType<typeof pdfDoc.embedJpg>> | null = null;
  const hasImagePlacements = placements.some(p => (p.fieldType || 'signature') === 'signature');

  if (hasImagePlacements && signatureDataUrl) {
    const format = detectImageFormat(signatureDataUrl);
    const imageBytes = await dataUrlToBytes(signatureDataUrl);
    signatureImage = format === 'png'
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);
  }

  // Embed standard fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Phase 2 P2.4 — expand ranges so a range placement gets stamped on
  // every page in `[start..end]`. Single-page placements emit a single
  // entry at `placement.page`. The pdf-side coords are recomputed per
  // page because pdf-lib exposes the page's true dimensions via
  // `getSize()` — works correctly even when mixed Letter/A4 PDFs are
  // loaded.
  const expanded = expandPlacementsToAllPages(placements, totalPages);

  for (const { page: pageNum, placement } of expanded) {
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= totalPages) continue;

    const page = pdfDoc.getPage(pageIndex);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();

    let pdfX: number;
    let pdfY: number;
    let pdfW: number;
    let pdfH: number;

    if (isRangePlacement(placement)) {
      // Range placements: x/y/w/h are normalized [0..1] ratios of the
      // page dimensions. Multiply directly by per-page pdfW/pdfH so a
      // stamp on a "0.5, 0.5, 0.2, 0.1" range lands at the same
      // proportional spot on a page regardless of its aspect ratio.
      pdfW = placement.width * pdfWidth;
      pdfH = placement.height * pdfHeight;
      pdfX = placement.x * pdfWidth;
      // Flip Y-axis (PDF origin is bottom-left): the top of the field
      // in screen space is `y * pdfHeight` from the bottom.
      pdfY = pdfHeight - placement.y * pdfHeight - pdfH;
    } else {
      const renderedHeight = renderedPageWidth * (pdfHeight / pdfWidth);
      pdfX = scaleToPdf(placement.x, pdfWidth, renderedPageWidth);
      pdfY = pdfHeight - scaleToPdf(placement.y + placement.height, pdfHeight, renderedHeight);
      pdfW = scaleToPdf(placement.width, pdfWidth, renderedPageWidth);
      pdfH = scaleToPdf(placement.height, pdfHeight, renderedHeight);
    }

    const fieldType: FieldType = placement.fieldType || 'signature';

    switch (fieldType) {
      case 'signature': {
        if (signatureImage) {
          page.drawImage(signatureImage, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
        }
        break;
      }

      case 'typed': {
        const text = placement.typedText || '';
        const fontSize = Math.min(pdfH * 0.5, 28);
        const textWidth = helvetica.widthOfTextAtSize(text, fontSize);
        const textX = pdfX + (pdfW - textWidth) / 2;
        const textY = pdfY + (pdfH - fontSize) / 2 + fontSize * 0.3;
        page.drawText(text, {
          x: Math.max(pdfX, textX),
          y: textY,
          size: fontSize,
          font: helvetica,
          color: rgb(0.1, 0.1, 0.1),
        });
        break;
      }

      case 'date': {
        const format = placement.dateFormat || 'MM/DD/YYYY';
        const dateText = formatDate(format);
        const fontSize = Math.min(pdfH * 0.5, 18);
        const textWidth = helvetica.widthOfTextAtSize(dateText, fontSize);
        const textX = pdfX + (pdfW - textWidth) / 2;
        const textY = pdfY + (pdfH - fontSize) / 2 + fontSize * 0.3;
        page.drawText(dateText, {
          x: Math.max(pdfX, textX),
          y: textY,
          size: fontSize,
          font: helvetica,
          color: rgb(0.1, 0.1, 0.1),
        });
        break;
      }

      case 'initials': {
        const text = (placement.typedText || '').toUpperCase();
        const fontSize = Math.min(pdfH * 0.6, 32);
        const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize);
        const textX = pdfX + (pdfW - textWidth) / 2;
        const textY = pdfY + (pdfH - fontSize) / 2 + fontSize * 0.3;
        page.drawText(text, {
          x: Math.max(pdfX, textX),
          y: textY,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        break;
      }

      case 'checkbox': {
        const size = Math.min(pdfW, pdfH, 20);
        const cx = pdfX + pdfW / 2;
        const cy = pdfY + pdfH / 2;
        // Draw checkbox square
        page.drawRectangle({
          x: cx - size / 2,
          y: cy - size / 2,
          width: size,
          height: size,
          borderColor: rgb(0.2, 0.2, 0.2),
          borderWidth: 1.5,
        });
        // Draw checkmark if checked
        if (placement.checked) {
          const checkSize = size * 0.6;
          page.drawText('✓', {
            x: cx - checkSize / 2,
            y: cy - checkSize / 3,
            size: checkSize,
            font: helvetica,
            color: rgb(0.1, 0.1, 0.1),
          });
        }
        break;
      }
    }
  }

  return await pdfDoc.save();
}
