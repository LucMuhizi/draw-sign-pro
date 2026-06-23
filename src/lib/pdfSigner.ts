import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatDate } from './utils';

export type FieldType = 'signature' | 'typed' | 'date' | 'initials' | 'checkbox';

/**
 * Returns true if a placed field has all the data it needs to render
 * into the final PDF. Used by the field-completion-pulse animation
 * (Phase 2 of premium-animations plan) to decide when to play the
 * scale-1→1.15→1 + green-border + checkmark beat.
 *
 * - signature: always complete (the image is the placement)
 * - date:      always complete (dateFormat defaults to MM/DD/YYYY)
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
      return !!sig.dateFormat;
    case 'signature':
    default:
      return true;
  }
}

export interface SignaturePlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
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

  // Only embed the signature image if any placement uses it
  let signatureImage: ReturnType<typeof pdfDoc.embedPng> | ReturnType<typeof pdfDoc.embedJpg> | null = null;
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

  for (const placement of placements) {
    const pageIndex = placement.page - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const renderedHeight = renderedPageWidth * (pdfHeight / pdfWidth);

    const pdfX = scaleToPdf(placement.x, pdfWidth, renderedPageWidth);
    const pdfY = pdfHeight - scaleToPdf(placement.y + placement.height, pdfHeight, renderedHeight);
    const pdfW = scaleToPdf(placement.width, pdfWidth, renderedPageWidth);
    const pdfH = scaleToPdf(placement.height, pdfHeight, renderedHeight);

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
