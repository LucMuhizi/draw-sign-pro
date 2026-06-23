import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { SignaturePlacement } from './pdfSigner';

export interface AuditRecord {
  documentName: string;
  documentHash: string;
  signatures: {
    id: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    placedAt: number;
  }[];
  signedAt: number;
}

export async function hashDocument(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    drawText(`#${i + 1} — Page ${s.page} at (${Math.round(s.x)}, ${Math.round(s.y)})`, 10);
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
