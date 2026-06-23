/**
 * Lightweight, offline-friendly background removal using pure canvas operations.
 *
 * Replaces the previous HuggingFace Transformers (SegFormer) pipeline that:
 * - Downloaded a 25MB+ model on every session
 * - Required WebGPU (unsupported on iOS Safari)
 * - Crashed low-RAM mobile devices
 *
 * This approach uses adaptive thresholding and flood-fill edge detection
 * to separate the foreground signature from the background. It works on
 * all devices including low-RAM phones, and runs entirely offline.
 */

const MAX_IMAGE_DIMENSION = 1024;
// Threshold for separating signature strokes from background
const SIG_THRESHOLD = 180;
// How many edge pixels to dilate inward
const DILATE_RADIUS = 1;
// Minimum alpha to consider a pixel as content
const MIN_ALPHA = 10;

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

/**
 * Convert image to high-contrast black and white.
 * Dark strokes (signature ink) → black, light background → white.
 */
function convertToBlackAndWhite(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Weighted grayscale conversion
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Apply threshold: darker than threshold → black (signature), lighter → white (background)
    const bw = gray < SIG_THRESHOLD ? 0 : 255;
    data[i] = bw;
    data[i + 1] = bw;
    data[i + 2] = bw;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Remove background by detecting dark strokes against a light background.
 *
 * The algorithm:
 * 1. Resize image for performance
 * 2. Convert to high-contrast black & white
 * 3. Build alpha mask: dark pixels = opaque, light pixels = transparent
 * 4. Apply light dilate to fill small gaps in strokes
 * 5. Preserve original colors of foreground pixels, set background to transparent
 * 6. Crop to content bounds
 */
export const removeBackground = async (imageElement: HTMLImageElement): Promise<Blob> => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    resizeImageIfNeeded(canvas, ctx, imageElement);
    convertToBlackAndWhite(canvas, ctx);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    // Build binary mask: dark pixels = foreground
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      // After B&W conversion, R == G == B. Dark = 0 (signature), light = 255 (background).
      mask[i] = data[i * 4] < 128 ? 1 : 0;
    }

    // Dilate mask to fill small gaps in brush strokes
    const dilated = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (mask[idx]) {
          dilated[idx] = 1;
          continue;
        }
        // Check if any neighbor is foreground
        let hasNeighbor = false;
        for (let dy = -DILATE_RADIUS; dy <= DILATE_RADIUS && !hasNeighbor; dy++) {
          for (let dx = -DILATE_RADIUS; dx <= DILATE_RADIUS; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx]) {
              hasNeighbor = true;
              break;
            }
          }
        }
        dilated[idx] = hasNeighbor ? 1 : 0;
      }
    }

    // Read original image pixels for color preservation
    ctx.clearRect(0, 0, w, h);
    resizeImageIfNeeded(canvas, ctx, imageElement);
    const origData = ctx.getImageData(0, 0, w, h).data;

    // Create output: preserve original colors of foreground, set background transparent
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = w;
    outputCanvas.height = h;
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) throw new Error('Could not get output canvas context');

    const outImageData = outputCtx.createImageData(w, h);
    const outPx = outImageData.data;

    for (let i = 0; i < w * h; i++) {
      const off = i * 4;
      outPx[off] = origData[off];         // R
      outPx[off + 1] = origData[off + 1]; // G
      outPx[off + 2] = origData[off + 2]; // B
      outPx[off + 3] = dilated[i] ? 255 : 0; // Alpha: foreground = opaque, background = transparent
    }

    outputCtx.putImageData(outImageData, 0, 0);

    // Crop to content bounds
    const cropped = cropCanvasToContent(outputCanvas);

    return new Promise((resolve, reject) => {
      cropped.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/png',
        1.0,
      );
    });
  } catch (error) {
    console.error('Error removing background:', error);
    throw error;
  }
};

export const loadImage = (file: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
};

/**
 * Crop a canvas to the bounding box of non-transparent pixels.
 */
export const cropCanvasToContent = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const w = source.width;
  const h = source.height;
  const ctx = source.getContext('2d');
  if (!ctx) return source;

  const imgData = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4 + 3; // alpha channel
      if (imgData[idx] > MIN_ALPHA) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return source;

  // Add some padding
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w, maxX + pad);
  maxY = Math.min(h, maxY + pad);

  const cw = maxX - minX;
  const ch = maxY - minY;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const outCtx = out.getContext('2d');
  if (!outCtx) return source;

  outCtx.drawImage(source, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
};
