import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface DetectedField {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

const SIGNATURE_KEYWORDS = ['signature', 'sign here', 'sign', 'x', 'authorized', 'approved', 'date', 'title', 'name'];
const OCR_RENDER_SCALE = 2;
const FIELD_PAD_X = 60;
const FIELD_PAD_Y = 30;

async function renderPageToCanvas(page: pdfjsLib.PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export async function detectSignatureFields(
  file: File,
  renderedPageWidth: number,
  numPages?: number,
): Promise<DetectedField[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const totalPages = numPages ?? pdf.numPages;

  const worker = await createWorker('eng');

  const allFields: DetectedField[] = [];

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pdfPage = await pdf.getPage(pageNum);
      const canvas = await renderPageToCanvas(pdfPage, OCR_RENDER_SCALE);
      const viewport = pdfPage.getViewport({ scale: 1 });

      const { data } = await worker.recognize(canvas);
      if (!data.words) continue;

      const scaleToScreen = renderedPageWidth / viewport.width;

      for (const word of data.words) {
        const text = word.text.trim();
        if (!text) continue;

        const matchedKeyword = SIGNATURE_KEYWORDS.find(k => text.toLowerCase().includes(k));
        if (!matchedKeyword) continue;

        const cx = (word.bbox.x0 + word.bbox.x1) / 2;
        const cy = (word.bbox.y0 + word.bbox.y1) / 2;
        const w = word.bbox.x1 - word.bbox.x0 + FIELD_PAD_X;
        const h = word.bbox.y1 - word.bbox.y0 + FIELD_PAD_Y;

        allFields.push({
          page: pageNum,
          x: (cx - w / 2) / OCR_RENDER_SCALE * scaleToScreen,
          y: (cy - h / 2) / OCR_RENDER_SCALE * scaleToScreen,
          width: w / OCR_RENDER_SCALE * scaleToScreen,
          height: h / OCR_RENDER_SCALE * scaleToScreen,
          label: text,
        });
      }
    }
  } finally {
    await worker.terminate();
  }

  return allFields;
}
