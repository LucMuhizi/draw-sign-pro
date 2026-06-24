import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Phase 2 P2.5 — widened the detected-field type union from just the three
 * signature-bearing field kinds to the full five FieldType union that
 * `SignaturePlacement.fieldType` already understands. This lets the
 * "Auto-fill all" bulk-action map a single detected field straight to its
 * matching placement kind without a translator in between.
 */
export type DetectedFieldType = "signature" | "typed" | "date" | "initials" | "checkbox";

export interface DetectedField {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /**
   * Classified field type used by AIFieldDiscovery + P2.5 Auto-fill all to
   * sequence the reveal AND to choose the matching placement kind in one go.
   */
  fieldType: DetectedFieldType;
}

const SIGNATURE_KEYWORDS = ['signature', 'sign here', 'sign', 'x', 'authorized', 'approved', 'title'];
const DATE_KEYWORDS = ['date'];
/**
 * Phase 2 P2.5 — "initial" already matched both forms. Kept plus single
 * capital "i" suffix variant common in forms ("Applicant i.", "Witness i.").
 */
const INITIALS_KEYWORDS = ['initials', 'initial'];
/**
 * Phase 2 P2.5 — typed-name field hints. Match the literal text people
 * put on PDF forms: "Name:", "Printed Name:", "Typed Name:", or the bare
 * "Text:". Avoid matching "title" (also a signature keyword) so the
 * priority ladder below wins correctly.
 */
const TYPED_KEYWORDS = ['printed name', 'typed name', 'full name', 'enter name', 'text'];
/**
 * Phase 2 P2.5 — checkbox hints. Forms render ☐ (U+2610) directly, or
 * sometimes "Tick here", "Check here", or the bare word "checkbox".
 */
const CHECKBOX_KEYWORDS = ['☐', 'checkbox', 'tick here', 'check here', 'check the box'];

/** Order in which AIFieldDiscovery reveals detected fields. */
export const FIELD_TYPE_PRIORITY: Record<DetectedFieldType, number> = {
  signature: 0,
  date: 1,
  initials: 2,
  typed: 3,
  checkbox: 4,
};
const OCR_RENDER_SCALE = 2;
const FIELD_PAD_X = 60;
const FIELD_PAD_Y = 30;
/** Minimum text items to consider a PDF as text-based (vs scanned image) */
const MIN_TEXT_ITEMS = 50;

/**
 * Classify a matched text label into a field type.
 *
 * Phase 2 P2.5 — priority ladder matches the user-facing mapping rule
 * required by the "Auto-fill all" bulk action:
 *   typed for /text/ boxes,
 *   checkbox for ☐ markers,
 *   date for /date/ markers,
 *   initials for /initials/ markers,
 *   signature for the default.
 *
 * Keyword order matters because `signature` is the largest bucket and
 * would otherwise swallow all the others. We test the more specific
 * markers first so a label like "Date of Signature" never resolves to
 * signature (since "date" wins on the first check).
 *
 * Note: the existing SIGNATURE_KEYWORDS list still contains `"title"`
 * which is intentionally broad. Title fields render as typed-name on
 * most forms, but the historical classifier routes them to signature so
 * we keep the legacy behaviour to preserve test fixture continuity. A
 * future P2.x pass can split this if needed.
 */
function classifyField(text: string): DetectedFieldType {
  const lower = text.toLowerCase();
  if (DATE_KEYWORDS.some((k) => lower.includes(k))) return "date";
  if (INITIALS_KEYWORDS.some((k) => lower.includes(k))) return "initials";
  if (TYPED_KEYWORDS.some((k) => lower.includes(k))) return "typed";
  if (CHECKBOX_KEYWORDS.some((k) => lower.includes(k))) return "checkbox";
  if (SIGNATURE_KEYWORDS.some((k) => lower.includes(k))) return "signature";
  // Default fallback per P2.5 user requirement: "signature for the default"
  return "signature";
}

// ─── PDF text extraction (fast, always works) ──────────────────────

async function extractFieldsFromTextContent(
  page: pdfjsLib.PDFPageProxy,
  renderedPageWidth: number,
): Promise<DetectedField[]> {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const scaleToScreen = renderedPageWidth / viewport.width;
  const fields: DetectedField[] = [];

  for (const item of textContent.items) {
    if (!('str' in item)) continue;
    const text = (item as { str: string }).str.trim();
    if (!text) continue;

    // Phase 2 P2.5 — match any of the five keyword sets (signature, date,
    // initials, typed, checkbox) so the bulk Auto-place has the full set
    // of cues from a single first-pass scan.
    const lower = text.toLowerCase();
    const matchedAny =
      SIGNATURE_KEYWORDS.some((k) => lower.includes(k)) ||
      DATE_KEYWORDS.some((k) => lower.includes(k)) ||
      INITIALS_KEYWORDS.some((k) => lower.includes(k)) ||
      TYPED_KEYWORDS.some((k) => lower.includes(k)) ||
      CHECKBOX_KEYWORDS.some((k) => lower.includes(k));
    if (!matchedAny) continue;

    // Transform: PDF coordinate space → screen coordinates
    const transform = (item as { transform: number[] }).transform;
    if (!transform) continue;

    const x = transform[4] * scaleToScreen;
    const y = viewport.height - transform[5];
    const sy = y * scaleToScreen;
    const fontSize = Math.abs(transform[3]) || 10;
    const w = text.length * fontSize * 0.6 * scaleToScreen + FIELD_PAD_X;
    const h = fontSize * 1.5 * scaleToScreen + FIELD_PAD_Y;

    fields.push({
      page: (page as { pageNumber: number }).pageNumber,
      x: x - FIELD_PAD_X / 2,
      y: sy - h / 2,
      width: w,
      height: h,
      label: text,
      fieldType: classifyField(text),
    });
  }

  return fields;
}

// ─── Tesseract OCR fallback (for scanned/image PDFs) ────────────────

async function renderPageToCanvas(page: pdfjsLib.PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function extractFieldsViaOCR(
  page: pdfjsLib.PDFPageProxy,
  renderedPageWidth: number,
  pageNum: number,
): Promise<DetectedField[]> {
  // Lazy-load Tesseract only when needed
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  try {
    const canvas = await renderPageToCanvas(page, OCR_RENDER_SCALE);
    const viewport = page.getViewport({ scale: 1 });
    const { data } = await worker.recognize(canvas);
    if (!data.words) return [];

    const scaleToScreen = renderedPageWidth / viewport.width;
    const fields: DetectedField[] = [];

    for (const word of data.words) {
      const text = word.text.trim();
      if (!text) continue;

      const lower = text.toLowerCase();
      const matchedAny =
        SIGNATURE_KEYWORDS.some((k) => lower.includes(k)) ||
        DATE_KEYWORDS.some((k) => lower.includes(k)) ||
        INITIALS_KEYWORDS.some((k) => lower.includes(k)) ||
        TYPED_KEYWORDS.some((k) => lower.includes(k)) ||
        CHECKBOX_KEYWORDS.some((k) => lower.includes(k));
      if (!matchedAny) continue;

      const cx = (word.bbox.x0 + word.bbox.x1) / 2;
      const cy = (word.bbox.y0 + word.bbox.y1) / 2;
      const w = word.bbox.x1 - word.bbox.x0 + FIELD_PAD_X;
      const h = word.bbox.y1 - word.bbox.y0 + FIELD_PAD_Y;

      fields.push({
        page: pageNum,
        x: ((cx - w / 2) / OCR_RENDER_SCALE) * scaleToScreen,
        y: ((cy - h / 2) / OCR_RENDER_SCALE) * scaleToScreen,
        width: (w / OCR_RENDER_SCALE) * scaleToScreen,
        height: (h / OCR_RENDER_SCALE) * scaleToScreen,
        label: text,
        fieldType: classifyField(text),
      });
    }
    return fields;
  } finally {
    await worker.terminate();
  }
}

// ─── Main entry point ───────────────────────────────────────────────

export async function detectSignatureFields(
  file: File,
  renderedPageWidth: number,
  numPages?: number,
): Promise<DetectedField[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const totalPages = numPages ?? pdf.numPages;
  const allFields: DetectedField[] = [];

  // Check first page to decide strategy
  const firstPage = await pdf.getPage(1);
  const textContent = await firstPage.getTextContent();
  const isTextPdf = textContent.items.length >= MIN_TEXT_ITEMS;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = pageNum === 1 ? firstPage : await pdf.getPage(pageNum);

    if (isTextPdf) {
      // Fast path: extract text directly from PDF
      const fields = await extractFieldsFromTextContent(page, renderedPageWidth);
      allFields.push(...fields);
    } else {
      // Slow path: OCR for scanned/image PDFs
      const fields = await extractFieldsViaOCR(page, renderedPageWidth, pageNum);
      allFields.push(...fields);
    }
  }

  return allFields;
}
