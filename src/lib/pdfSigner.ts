import { PDFDocument } from 'pdf-lib';

export interface SignaturePlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
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

export async function embedSignaturesIntoPDF(
  pdfBytes: ArrayBuffer,
  signatureDataUrl: string,
  placements: SignaturePlacement[],
  renderedPageWidth: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const format = detectImageFormat(signatureDataUrl);
  const imageBytes = await dataUrlToBytes(signatureDataUrl);
  const signatureImage = format === 'png'
    ? await pdfDoc.embedPng(imageBytes)
    : await pdfDoc.embedJpg(imageBytes);

  for (const placement of placements) {
    const pageIndex = placement.page - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const renderedHeight = renderedPageWidth * (pdfHeight / pdfWidth);
    const scale = pdfWidth / renderedPageWidth;

    const pdfX = placement.x * scale;
    const pdfY = pdfHeight - (placement.y + placement.height) * scale;
    const pdfW = placement.width * scale;
    const pdfH = placement.height * scale;

    page.drawImage(signatureImage, {
      x: pdfX,
      y: pdfY,
      width: pdfW,
      height: pdfH,
    });
  }

  return await pdfDoc.save();
}
