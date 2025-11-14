import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

const MAX_IMAGE_DIMENSION = 1024;

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

export const removeBackground = async (imageElement: HTMLImageElement): Promise<Blob> => {
  try {
    console.log('Starting background removal...');
    const segmenter = await pipeline(
      'image-segmentation', 
      'Xenova/segformer-b0-finetuned-ade-512-512',
      { device: 'webgpu' }
    );
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    resizeImageIfNeeded(canvas, ctx, imageElement);
    console.log(`Image dimensions: ${canvas.width}x${canvas.height}`);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    console.log('Processing with segmentation model...');
    const result = await segmenter(imageData);
    
    if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
      throw new Error('Invalid segmentation result');
    }
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    outputCtx.drawImage(canvas, 0, 0);
    
    const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = outputImageData.data;
    
    for (let i = 0; i < result[0].mask.data.length; i++) {
      const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
      data[i * 4 + 3] = alpha;
    }
    
    outputCtx.putImageData(outputImageData, 0, 0);
    console.log('Background removed successfully');

    // Post-process to make signature strokes clearer but preserve original
    // stroke colors. We'll be conservative to avoid removing thin strokes.
    const w = outputCanvas.width;
    const h = outputCanvas.height;
    const img = outputCtx.getImageData(0, 0, w, h);
    const px = img.data;

    // Build initial binary mask from alpha channel
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = px[i * 4 + 3];
      mask[i] = a > 8 ? 1 : 0; // more permissive threshold
    }

    const neighborsSet = (m: Uint8Array, x: number, y: number) => {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
            m[ny * w + nx] = 1;
          }
        }
      }
    };

    // A conservative dilate (1 iteration)
    const proc = mask.slice();
    const tmp = proc.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) neighborsSet(tmp, x, y);
      }
    }
    // Erode once to smooth (closing)
    const eroded = tmp.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (tmp[idx]) {
          // check neighborhood
          let keep = 1;
          for (let oy = -1; oy <= 1 && keep; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = x + ox;
              const ny = y + oy;
              if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
                if (tmp[ny * w + nx] === 0) {
                  keep = 0;
                  break;
                }
              }
            }
          }
          eroded[idx] = keep;
        } else {
          eroded[idx] = 0;
        }
      }
    }

    // Preserve original RGB values but set alpha based on processed mask
    for (let i = 0; i < w * h; i++) {
      const off = i * 4;
      if (eroded[i]) {
        // keep original color, ensure fully opaque
        px[off + 3] = 255;
      } else {
        // transparent
        px[off + 3] = 0;
      }
    }

    outputCtx.putImageData(img, 0, 0);

    // Crop canvas to content (non-transparent pixels) to keep only the signature
    const cropped = cropCanvasToContent(outputCanvas);

    return new Promise((resolve, reject) => {
      cropped.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/png',
        1.0
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
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
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
      if (imgData[idx] > 10) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return source; // nothing detected, return original

  // add some padding
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
