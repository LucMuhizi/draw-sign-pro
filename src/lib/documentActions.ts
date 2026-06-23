import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { embedSignaturesIntoPDF } from "@/lib/pdfSigner";
import { composeSignedImage, loadImage } from "@/lib/imageSigner";
import { hashDocument, generateCertificate, appendCertificateToDocument } from "@/lib/auditTrail";
import { shareDocument } from "@/lib/share";
import type { SignaturePlacement } from "@/lib/pdfSigner";
import { isDocxFile } from "@/lib/docxConverter";

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) => arrayBufferToBase64(new Uint8Array(buf)));
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface DownloadOptions {
  file: File;
  fileUrl: string;
  isImage: boolean;
  isDocx: boolean;
  signature: string;
  signatures: SignaturePlacement[];
  pageWidth: number;
  numPages: number;
  containerElement: HTMLElement;
}

/**
 * Render the docx content div + signature overlays to a canvas, then embed as a PDF.
 * Uses the div-based docx renderer from DocumentViewer (not an iframe).
 */
async function renderDocxToPdfBlob(
  containerElement: HTMLElement,
  signatureDataUrl: string,
  placements: SignaturePlacement[],
): Promise<Blob> {
  // Find the docx content div (the one with white background + text content)
  const docxDiv = containerElement.querySelector("[data-docx-content]") as HTMLElement | null;
  if (!docxDiv) {
    throw new Error("Could not access document content");
  }

  const contentWidth = docxDiv.clientWidth;
  const scrollHeight = docxDiv.scrollHeight;
  const scale = 2; // 2x for crisp text

  // Clone the docx div into a temporary off-screen div for canvas rendering
  const tempDiv = document.createElement("div");
  tempDiv.style.cssText = `position:absolute;left:-9999px;top:0;width:${contentWidth}px;background:#fff;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;padding:40px 48px;`;
  tempDiv.innerHTML = docxDiv.innerHTML;
  document.body.appendChild(tempDiv);

  try {
    // Canvas for text rendering
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = contentWidth * scale;
    tempCanvas.height = tempDiv.scrollHeight * scale;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.scale(scale, scale);
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, contentWidth, tempDiv.scrollHeight);

    // Render text nodes with word wrap
    function renderNode(node: Node, offsetY: number): number {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        const text = node.textContent.trim();
        const parent = node.parentElement;
        if (!parent) return offsetY;

        const computedStyle = window.getComputedStyle(parent);
        const fontSize = parseFloat(computedStyle.fontSize) || 14;
        const fontWeight = computedStyle.fontWeight === "bold" || computedStyle.fontWeight >= "600" ? "bold " : "";
        const isHeader = /^H[1-6]$/.test(parent.tagName);
        const headerScale = isHeader ? 1.5 : 1;

        tempCtx.font = `${fontWeight}${fontSize * headerScale}px 'Segoe UI', Calibri, Arial, sans-serif`;
        tempCtx.fillStyle = "#1a1a1a";
        tempCtx.textBaseline = "top";

        const marginLeft = 48;
        const maxWidth = contentWidth - marginLeft - 48;
        const lineHeight = fontSize * 1.6 * headerScale;

        // Simple word wrap
        const words = text.split(" ");
        let line = "";
        let y = offsetY;
        for (const word of words) {
          const testLine = line ? line + " " + word : word;
          if (tempCtx.measureText(testLine).width > maxWidth && line) {
            tempCtx.fillText(line, marginLeft, y);
            y += lineHeight;
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) {
          tempCtx.fillText(line, marginLeft, y);
          y += lineHeight;
        }

        return y + (isHeader ? fontSize * 0.5 : 0);
      }

      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR") {
        return offsetY + 20;
      }

      let y = offsetY;
      for (const child of node.childNodes) {
        y = renderNode(child, y);
      }
      return y;
    }

    let contentEnd = 0;
    for (const child of tempDiv.childNodes) {
      contentEnd = renderNode(child, contentEnd);
    }

    // Crop canvas to actual content
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = contentWidth * scale;
    croppedCanvas.height = Math.max(contentEnd + 40, 600) * scale;
    const croppedCtx = croppedCanvas.getContext("2d")!;
    croppedCtx.scale(scale, scale);
    croppedCtx.fillStyle = "#ffffff";
    croppedCtx.fillRect(0, 0, contentWidth, Math.max(contentEnd + 40, 600));
    croppedCtx.drawImage(tempCanvas, 0, 0);

    // Draw signature overlays
    if (signatureDataUrl) {
      try {
        const sigImg = await loadImage(signatureDataUrl);
        for (const p of placements) {
          if ((p.fieldType || "signature") === "signature") {
            croppedCtx.drawImage(sigImg, p.x * scale, p.y * scale, p.width * scale, p.height * scale);
          } else if (p.fieldType === "typed" || p.fieldType === "initials") {
            const text = (p.typedText || "").toUpperCase();
            const fontSize = p.fieldType === "initials" ? Math.min(p.height * 0.5, 32) : Math.min(p.height * 0.45, 22);
            croppedCtx.font = `${p.fieldType === "initials" ? "bold " : ""}${fontSize}px serif`;
            croppedCtx.fillStyle = "#1a1a1a";
            croppedCtx.textAlign = "center";
            croppedCtx.textBaseline = "middle";
            croppedCtx.fillText(text, (p.x + p.width / 2) * scale, (p.y + p.height / 2) * scale);
          } else if (p.fieldType === "date") {
            const dateText = new Date().toLocaleDateString();
            const fontSize = Math.min(p.height * 0.45, 18);
            croppedCtx.font = `${fontSize}px sans-serif`;
            croppedCtx.fillStyle = "#1a1a1a";
            croppedCtx.textAlign = "center";
            croppedCtx.textBaseline = "middle";
            croppedCtx.fillText(dateText, (p.x + p.width / 2) * scale, (p.y + p.height / 2) * scale);
          } else if (p.fieldType === "checkbox") {
            const size = Math.min(p.width, p.height, 24) * scale;
            const cx = (p.x + p.width / 2) * scale;
            const cy = (p.y + p.height / 2) * scale;
            croppedCtx.strokeStyle = "#333";
            croppedCtx.lineWidth = 2;
            croppedCtx.strokeRect(cx - size / 2, cy - size / 2, size, size);
            if (p.checked) {
              croppedCtx.font = `${size * 0.7}px sans-serif`;
              croppedCtx.fillStyle = "#1a1a1a";
              croppedCtx.textAlign = "center";
              croppedCtx.textBaseline = "middle";
              croppedCtx.fillText("✓", cx, cy);
            }
          }
        }
      } catch {
        // Signature image failed to load — render docx content without overlays
        console.warn("Could not load signature image for docx render");
      }
    }

    return new Promise((resolve) => {
      croppedCanvas.toBlob((blob) => resolve(blob!), "image/png");
    });
  } finally {
    document.body.removeChild(tempDiv);
  }
}

/**
 * Generate and download a signed document (native or browser).
 */
export async function downloadSignedDocument(opts: DownloadOptions): Promise<string> {
  const { file, fileUrl, isImage, isDocx, signature, signatures, pageWidth, numPages, containerElement } = opts;
  const isNative = Capacitor.isNativePlatform();
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const fileName = `signed-${baseName}`;

  // ─── Docx: convert docx div HTML to image, then to PDF ────────────
  if (isDocx) {
    const pngBlob = await renderDocxToPdfBlob(containerElement, signature, signatures);
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter

    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const image = await pdfDoc.embedPng(pngBytes);
    const imgDims = image.scale(1);

    // Scale to fit page width
    const margin = 36;
    const availableWidth = 612 - margin * 2;
    const scale = Math.min(availableWidth / imgDims.width, 1);
    const drawWidth = imgDims.width * scale;
    const drawHeight = imgDims.height * scale;

    // If image is taller than one page, spread across multiple pages
    const maxPageHeight = 792 - margin * 2;
    const totalNeededHeight = drawHeight;
    const numOutputPages = Math.ceil(totalNeededHeight / maxPageHeight);

    for (let i = 0; i < numOutputPages; i++) {
      if (i > 0) pdfDoc.addPage([612, 792]);
      const currentPage = pdfDoc.getPage(i);
      const srcY = i * maxPageHeight / scale;
      const srcH = Math.min(maxPageHeight / scale, imgDims.height - srcY);
      const dstH = srcH * scale;

      currentPage.drawImage(image, {
        x: margin,
        y: 792 - margin - dstH,
        width: drawWidth,
        height: dstH,
      });
    }

    const finalPdfBytes = await pdfDoc.save();

    if (isNative) {
      const base64Data = arrayBufferToBase64(finalPdfBytes);
      await Filesystem.writeFile({
        path: `${fileName}.pdf`,
        data: base64Data,
        directory: Directory.Documents,
      });
    } else {
      const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
    return fileName;
  }

  // ─── Image documents ─────────────────────────────────────────────
  if (isImage) {
    const imgEl = containerElement.querySelector("img");
    if (!imgEl) throw new Error("Could not find document image");

    const displayedWidth = imgEl.clientWidth;
    const displayedHeight = imgEl.clientHeight;

    const blob = await composeSignedImage(file, signature, signatures, displayedWidth, displayedHeight);

    if (isNative) {
      const base64Data = await blobToBase64(blob);
      const result = await Filesystem.writeFile({
        path: `${fileName}.png`,
        data: base64Data,
        directory: Directory.Documents,
      });
      toast.success(`Document saved to Documents folder!\nPath: ${result.uri}`, { duration: 8000 });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }
    return fileName;
  }

  // ─── PDF documents ───────────────────────────────────────────────
  const response = await fetch(fileUrl);
  const pdfBytes = await response.arrayBuffer();

  const signedPdfBytes = await embedSignaturesIntoPDF(pdfBytes, signature, signatures, pageWidth);

  const docHash = await hashDocument(file);
  const certificate = await generateCertificate({
    documentName: file.name,
    documentHash: docHash,
    signatures: signatures.map((s) => ({
      id: s.id, page: s.page, x: s.x, y: s.y, width: s.width, height: s.height, placedAt: Date.now(),
    })),
    signedAt: Date.now(),
  });
  const finalPdfBytes = await appendCertificateToDocument(signedPdfBytes, certificate);

  if (isNative) {
    const base64Data = arrayBufferToBase64(finalPdfBytes);
    const result = await Filesystem.writeFile({
      path: `${fileName}.pdf`,
      data: base64Data,
      directory: Directory.Documents,
    });
    toast.success(`Document saved to Documents folder!\nPath: ${result.uri}`, { duration: 8000 });
  } else {
    const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return fileName;
}

/**
 * Share a document using the native share sheet or browser download.
 */
export async function shareSignedDocument(fileUrl: string, file: File): Promise<void> {
  const blob = new Blob([await fetch(fileUrl).then((r) => r.arrayBuffer())], { type: file.type });
  await shareDocument(blob, file.name);
}
