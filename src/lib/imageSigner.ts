import type { SignaturePlacement } from './pdfSigner';

function loadImage(src: string): Promise<HTMLImageElement> {
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
  displayedHeight: number
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

  const sigImg = await loadImage(signatureDataUrl);

  for (const p of placements) {
    const natX = p.x * scaleX;
    const natY = p.y * scaleY;
    const natW = p.width * scaleX;
    const natH = p.height * scaleY;
    ctx.drawImage(sigImg, natX, natY, natW, natH);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob from canvas'));
      },
      'image/png'
    );
  });
}
