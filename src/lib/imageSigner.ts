import type { SignaturePlacement, FieldType } from './pdfSigner';
import { formatDate } from './utils';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function composeSignedImage(
  imageFile: File,
  signatureDataUrl: string,
  placements: SignaturePlacement[],
  displayedWidth: number,
  displayedHeight: number,
): Promise<Blob> {
  const img = await loadImage(URL.createObjectURL(imageFile));
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  const scaleX = naturalWidth / displayedWidth;
  const scaleY = naturalHeight / displayedHeight;

  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0);

  const sigImg = placements.some(p => (p.fieldType || 'signature') === 'signature')
    ? await loadImage(signatureDataUrl)
    : null;

  for (const p of placements) {
    // Phase 2 P2.4 — range placements carry normalized [0..1] coords
    // so the same record can stamp proportional positions on every
    // page in a multi-page span. For image output (single page), we
    // scale the ratio directly against the image's natural dimensions
    // — the result is identical to per-pixel scaling because an image
    // has just one "page" to fit.
    const isRange = !!p.range;
    const natX = isRange ? p.x * naturalWidth : p.x * scaleX;
    const natY = isRange ? p.y * naturalHeight : p.y * scaleY;
    const natW = isRange ? p.width * naturalWidth : p.width * scaleX;
    const natH = isRange ? p.height * naturalHeight : p.height * scaleY;
    const fieldType: FieldType = p.fieldType || 'signature';

    switch (fieldType) {
      case 'signature': {
        if (sigImg) ctx.drawImage(sigImg, natX, natY, natW, natH);
        break;
      }
      case 'typed': {
        const text = p.typedText || '';
        const fontSize = Math.min(natH * 0.45, 28);
        ctx.font = `${fontSize}px serif`;
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, natX + natW / 2, natY + natH / 2);
        break;
      }
      case 'date': {
        const dateText = formatDate(p.dateFormat || 'MM/DD/YYYY');
        const fontSize = Math.min(natH * 0.45, 18);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dateText, natX + natW / 2, natY + natH / 2);
        break;
      }
      case 'initials': {
        const text = (p.typedText || '').toUpperCase();
        const fontSize = Math.min(natH * 0.5, 32);
        ctx.font = `bold ${fontSize}px serif`;
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, natX + natW / 2, natY + natH / 2);
        break;
      }
      case 'checkbox': {
        const size = Math.min(natW, natH, 24);
        const cx = natX + natW / 2;
        const cy = natY + natH / 2;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
        if (p.checked) {
          ctx.font = `${size * 0.7}px sans-serif`;
          ctx.fillStyle = '#1a1a1a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', cx, cy);
        }
        break;
      }
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      'image/png',
    );
  });
}
