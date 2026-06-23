import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format today's date using a pattern string.
 * Supported tokens: MM, DD, YYYY, YY
 * Example: formatDate("MM/DD/YYYY") → "06/15/2026"
 */
/**
 * Render typed text on a canvas to produce a PNG data URL.
 * Used by both SignatureCreator and QuickSignOverlay.
 */
export function renderTypedSignature(text: string, fontFamily: string, fontSize: number, color: string): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const padding = 20;
  canvas.width = Math.max(200, metrics.width + padding * 2);
  canvas.height = fontSize * 1.6 + padding * 2;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - metrics.width / 2, canvas.height / 2 + fontSize * 0.3);
  ctx.lineTo(canvas.width / 2 + metrics.width / 2, canvas.height / 2 + fontSize * 0.3);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

/**
 * Format a date string with MM, DD, YYYY, YY tokens.
 */
export function formatDate(format: string): string {
  const now = new Date();
  const map: Record<string, string> = {
    MM: String(now.getMonth() + 1).padStart(2, '0'),
    DD: String(now.getDate()).padStart(2, '0'),
    YYYY: String(now.getFullYear()),
    YY: String(now.getFullYear()).slice(-2),
  };
  return format.replace(/MM|DD|YYYY|YY/g, (m) => map[m] || m);
}
