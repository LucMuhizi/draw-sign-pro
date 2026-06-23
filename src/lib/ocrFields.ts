import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export type DetectedFieldType = "signature" | "date" | "initials";

export interface DetectedField {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /**
   * Classified field type used by AIFieldDiscovery to sequence the reveal.
   * Signature fields animate first, then date, then initials.
   */
  fieldType: DetectedFieldType;
}

const SIGNATURE_KEYWORDS = ['signature', 'sign here', 'sign', 'x', 'authorized', 'approved', 'title', 'name'];
const DATE_KEYWORDS = ['date'];
const INITIALS_KEYWORDS = ['initials', 'initial'];
/** Order in which AIFieldDiscovery reveals detected fields. */
export const FIELD_TYPE_PRIORITY: Record<DetectedFieldType, number> = {
  signature: 0,
  date: 1,
  initials: 2,
};
const OCR_RENDER_SCALE = 2;
const FIELD_PAD_X = 60;
const FIELD_PAD_Y = 30;
/** Minimum text items to consider a PDF as text-based (vs scanned image) */
const MIN_TEXT_ITEMS = 50;

/**
 * Classify a matched text label into a field type. Date takes precedence
 * over initials which takes precedence over signature (signature keywords
 * are the most permissive).
 */
function classifyField(text: string): DetectedFieldType {
  const lower = text.toLowerCase();
  if (DATE_KEYWORDS.some((k) => lower.includes(k))) return "date";
  if (INITIALS_KEYWORDS.some((k) => lower.includes(k))) return "initials";
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

    const matchedKeyword = SIGNATURE_KEYWORDS.find(k => text.toLowerCase().includes(k));
    if (!matchedKeyword) continue;

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

      const matchedKeyword = SIGNATURE_KEYWORDS.find(k => text.toLowerCase().includes(k));
      if (!matchedKeyword) continue;

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
