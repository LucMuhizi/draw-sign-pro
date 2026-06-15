import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, Trash2, Check, Signature, ScanLine, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { embedSignaturesIntoPDF } from "@/lib/pdfSigner";
import { composeSignedImage } from "@/lib/imageSigner";
import type { SignaturePlacement } from "@/lib/pdfSigner";
import type { SavedSignature } from "@/lib/signatureStorage";
import { useAuth } from "@/lib/AuthContext";
import { saveDocumentRecord } from "@/lib/documentHistory";
import { hashDocument, generateCertificate, appendCertificateToDocument } from "@/lib/auditTrail";
import { detectSignatureFields, type DetectedField } from "@/lib/ocrFields";
import { motion, AnimatePresence } from "framer-motion";
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics";
import { shareDocument } from "@/lib/share";
import { VoiceAnnotation } from "@/components/VoiceAnnotation";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  file: File;
  signature?: string;
  onBack?: () => void;
  onSignaturePlaced?: (count: number) => void;
  savedSignatures?: SavedSignature[];
  onSignatureChange?: (signature: string) => void;
}

export const DocumentViewer = ({ file, signature, onBack, onSignaturePlaced, savedSignatures, onSignatureChange }: DocumentViewerProps) => {
  const { user } = useAuth();
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [signatures, setSignatures] = useState<SignaturePlacement[]>([]);
  const [draggingSignature, setDraggingSignature] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isImage, setIsImage] = useState(false);
  const [pageWidth, setPageWidth] = useState<number>(800);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [resizingSignature, setResizingSignature] = useState<string | null>(null);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [attachedVoices, setAttachedVoices] = useState<Record<string, { blobUrl: string; duration: number }>>({});
  const pinchRef = useRef<{ sigId: string; dist: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setIsImage(file.type.startsWith("image/"));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const updateWidth = () => {
      const parent = containerRef.current;
      const padding = 32;
      let w = 800;
      if (parent) {
        w = parent.clientWidth - padding;
      } else if (typeof window !== 'undefined') {
        w = Math.min(800, window.innerWidth - padding);
      }
      w = Math.max(280, Math.min(800, w));
      setPageWidth(Math.round(w));
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    toast.success("Document loaded successfully!");
  };

  const addSignature = () => {
    if (!signature) {
      toast.error("Please create a signature first");
      return;
    }

    const newSignature: SignaturePlacement = {
      id: `sig-${Date.now()}`,
      x: 100,
      y: 100,
      width: 150,
      height: 60,
      page: currentPage,
    };
    const next = [...signatures, newSignature];
    setSignatures(next);
    hapticMedium();
    toast.success("Signature added! Drag to position it.");
    onSignaturePlaced?.(next.length);
  };

  const handlePointerDown = (e: React.PointerEvent, sigId?: string) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (sigId) {
      const sig = signatures.find((s) => s.id === sigId);
      if (!sig) return;
      setDraggingSignature(sigId);
      setDragOffset({ x: e.clientX - sig.x - rect.left, y: e.clientY - sig.y - rect.top });
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (signatures.length > 0) {
      const last = signatures[signatures.length - 1];
      const x = Math.max(0, Math.min(e.clientX - rect.left - last.width / 2, rect.width - last.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top - last.height / 2, rect.height - last.height));
      setSignatures(signatures.map((s, i) => i === signatures.length - 1 ? { ...s, x, y } : s));
      onSignaturePlaced?.(signatures.length);
      return;
    }

    if (signature) {
      const newSignature: SignaturePlacement = {
        id: `sig-${Date.now()}`,
        x: Math.max(0, Math.min(e.clientX - rect.left - 75, rect.width - 150)),
        y: Math.max(0, Math.min(e.clientY - rect.top - 30, rect.height - 60)),
        width: 150,
        height: 60,
        page: currentPage,
      };
      const next = [...signatures, newSignature];
      setSignatures(next);
      onSignaturePlaced?.(next.length);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (draggingSignature) {
      const sig = signatures.find((s) => s.id === draggingSignature);
      if (!sig) return;
      const x = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - sig.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - sig.height));
      setSignatures(signatures.map((s) => s.id === draggingSignature ? { ...s, x, y } : s));
      return;
    }

    if (resizingSignature && resizeCorner) {
      const sig = signatures.find((s) => s.id === resizingSignature);
      if (!sig) return;
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      let newW = resizeStart.w;
      let newH = resizeStart.h;
      let newX = sig.x;
      let newY = sig.y;

      if (resizeCorner.includes('r')) newW = Math.max(40, resizeStart.w + dx);
      if (resizeCorner.includes('l')) { newW = Math.max(40, resizeStart.w - dx); newX = sig.x + (resizeStart.w - newW); }
      if (resizeCorner.includes('b')) newH = Math.max(20, resizeStart.h + dy);
      if (resizeCorner.includes('t')) { newH = Math.max(20, resizeStart.h - dy); newY = sig.y + (resizeStart.h - newH); }

      setSignatures(signatures.map((s) => s.id === resizingSignature ? { ...s, x: newX, y: newY, width: newW, height: newH } : s));
    }
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    setDraggingSignature(null);
    setResizingSignature(null);
    setResizeCorner(null);
    if (e && (e.target as Element).releasePointerCapture) {
      (e.target as Element).releasePointerCapture(e.pointerId);
    }
  };

  const handleResizeStart = (e: React.PointerEvent, sigId: string, corner: string) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const sig = signatures.find(s => s.id === sigId);
    if (!sig) return;
    setResizingSignature(sigId);
    setResizeCorner(corner);
    setResizeStart({ x: e.clientX, y: e.clientY, w: sig.width, h: sig.height });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const removeSignature = (sigId: string) => {
    const newSigs = signatures.filter((sig) => sig.id !== sigId);
    setSignatures(newSigs);
    hapticLight();
    toast.success("Signature removed");
    onSignaturePlaced?.(newSigs.length);
  };

  const handleDetectFields = async () => {
    setOcrLoading(true);
    try {
      const fields = await detectSignatureFields(file, pageWidth, numPages || undefined);
      setDetectedFields(fields);
      if (fields.length > 0) {
        toast.success(`Found ${fields.length} field(s) — click to place signature`);
      } else {
        toast.info('No signature fields detected');
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast.error('Failed to detect fields');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFieldClick = (field: DetectedField) => {
    if (!signature) {
      toast.error('Please create a signature first');
      return;
    }
    const newSignature: SignaturePlacement = {
      id: `sig-${Date.now()}`,
      x: field.x,
      y: field.y,
      width: Math.min(field.width, 200),
      height: Math.min(field.height, 80),
      page: field.page,
    };
    const next = [...signatures, newSignature];
    setSignatures(next);
    onSignaturePlaced?.(next.length);
    toast.success(`Signature placed at "${field.label}"`);
  };

  const handleTouchStart = (e: React.TouchEvent, sigId: string) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      const sig = signatures.find(s => s.id === sigId);
      if (!sig) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { sigId, dist: Math.sqrt(dx * dx + dy * dy), w: sig.width, h: sig.height };
      setDraggingSignature(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchRef.current.dist;
      const newW = Math.max(40, Math.round(pinchRef.current.w * scale));
      const newH = Math.max(20, Math.round(pinchRef.current.h * scale));
      setSignatures(sigs =>
        sigs.map(s => s.id === pinchRef.current?.sigId ? { ...s, width: newW, height: newH } : s)
      );
    }
  };

  const handleTouchEnd = () => {
    if (pinchRef.current) {
      hapticLight();
      pinchRef.current = null;
    }
  };

  const handleVoiceAttach = (sigId: string, blobUrl: string, duration: number) => {
    setAttachedVoices(prev => ({ ...prev, [sigId]: { blobUrl, duration } }));
    hapticLight();
  };

  const handleVoiceDetach = (sigId: string) => {
    setAttachedVoices(prev => {
      const next = { ...prev };
      delete next[sigId];
      return next;
    });
  };

  const downloadSignedDocument = async () => {
    if (!containerRef.current || !signature || signatures.length === 0) return;

    let toastId: string | number | undefined;
    try {
      toastId = toast.loading("Generating signed document...");

      const isNative = Capacitor.isNativePlatform();
      const fileName = `signed-${file.name.replace(/\.[^/.]+$/, "")}`;

      if (isImage) {
        const imgEl = containerRef.current.querySelector('img');
        if (!imgEl) {
          toast.error("Could not find document image");
          return;
        }

        const displayedWidth = imgEl.clientWidth;
        const displayedHeight = imgEl.clientHeight;

        const blob = await composeSignedImage(
          file,
          signature,
          signatures,
          displayedWidth,
          displayedHeight
        );

        if (isNative) {
          const base64Data = await blobToBase64(blob);
          const result = await Filesystem.writeFile({
            path: `${fileName}.png`,
            data: base64Data,
            directory: Directory.Documents,
          });
          toast.success(`Document saved to Documents folder!\nPath: ${result.uri}`, { id: toastId, duration: 8000 });
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}.png`;
          link.click();
          URL.revokeObjectURL(url);
          toast.success('Document downloaded!', { id: toastId });
        }
        if (user?.id) saveDocumentRecord(user.id, file.name, 1, signatures.length);
      } else {
        const response = await fetch(fileUrl);
        const pdfBytes = await response.arrayBuffer();

        const signedPdfBytes = await embedSignaturesIntoPDF(
          pdfBytes,
          signature,
          signatures,
          pageWidth
        );

        const docHash = await hashDocument(file);
        const certificate = await generateCertificate({
          documentName: file.name,
          documentHash: docHash,
          signatures: signatures.map(s => ({
            id: s.id,
            page: s.page,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
            placedAt: Date.now(),
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
          toast.success(`Document saved to Documents folder!\nPath: ${result.uri}`, { id: toastId, duration: 8000 });
        } else {
          const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
          toast.success('Document downloaded!', { id: toastId });
        }
        if (user?.id) saveDocumentRecord(user.id, file.name, numPages || 1, signatures.length);
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document", { id: toastId });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mx-auto p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="hover:bg-card">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">{file.name}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const blob = new Blob([await fetch(fileUrl).then(r => r.arrayBuffer())], { type: file.type });
              await shareDocument(blob, file.name);
            }}
            className="hover:bg-card"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            onClick={downloadSignedDocument}
            disabled={signatures.length === 0}
            className="bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-soft hover:shadow-medium"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Save
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border shadow-soft">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          {!isImage && (
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center font-mono">
                {currentPage} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!isImage && numPages > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectFields}
                disabled={ocrLoading}
                className="text-xs border-primary/30 hover:border-primary/60"
              >
                <ScanLine className="w-3.5 h-3.5 mr-1" />
                {ocrLoading ? 'Detecting...' : 'Auto-detect'}
              </Button>
            )}
            <Button onClick={addSignature} disabled={!signature} size="sm" className="bg-primary/90">
              <Signature className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {savedSignatures && savedSignatures.length > 1 && (
          <div className="flex items-center gap-2 mb-4 pb-2 overflow-x-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Active:</span>
            {savedSignatures.map((saved) => (
              <button
                key={saved.id}
                onClick={() => onSignatureChange?.(saved.dataUrl)}
                className={`relative flex-shrink-0 w-20 h-10 rounded-lg border-2 transition-all p-0.5 flex items-center justify-center ${
                  signature === saved.dataUrl
                    ? 'border-primary bg-primary/5 shadow-glow'
                    : 'border-border hover:border-primary/50 bg-card/50'
                }`}
              >
                <img
                  src={saved.dataUrl}
                  alt={saved.label}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
                {signature === saved.dataUrl && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-glow">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div
          ref={containerRef}
          className="relative bg-accent/20 rounded-xl overflow-hidden border border-border/50"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {isImage ? (
            <img src={fileUrl} alt="Document" className="w-full h-auto max-w-full" />
          ) : (
            <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
              <Page pageNumber={currentPage} width={pageWidth} />
            </Document>
          )}

          {detectedFields
            .filter((f) => isImage || f.page === currentPage)
            .map((field) => (
              <div
                key={`field-${field.page}-${Math.round(field.x)}-${Math.round(field.y)}`}
                className="absolute border-2 border-dashed border-blue-400/60 rounded-lg cursor-pointer hover:bg-blue-400/10 transition-colors flex items-center justify-center group"
                style={{
                  left: field.x,
                  top: field.y,
                  width: field.width,
                  height: field.height,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFieldClick(field);
                }}
              >
                <span className="text-[10px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 px-1 rounded whitespace-nowrap">
                  {field.label}
                </span>
              </div>
            ))}
          {signatures
            .filter((sig) => isImage || sig.page === currentPage)
            .map((sig) => (
              <div
                key={sig.id}
                className="absolute group touch-none"
                style={{
                  left: sig.x,
                  top: sig.y,
                  width: sig.width,
                  height: sig.height,
                }}
                onPointerDown={(e) => handlePointerDown(e, sig.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onTouchStart={(e) => handleTouchStart(e, sig.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={signature}
                  alt="Signature"
                  className="w-full h-full object-contain bg-background/90 rounded pointer-events-none"
                  draggable={false}
                />
                <button
                  onClick={() => removeSignature(sig.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10 shadow-md hover:scale-110"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute -bottom-7 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <VoiceAnnotation
                    signatureId={sig.id}
                    onAttach={handleVoiceAttach}
                    onDetach={handleVoiceDetach}
                    attachedVoice={attachedVoices[sig.id] || null}
                  />
                </div>
              </div>
            ))}

          {!isImage && numPages > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-background/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-border/50">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    p === currentPage
                      ? 'bg-primary scale-125 shadow-glow'
                      : signatures.some(s => s.page === p)
                        ? 'bg-primary/50'
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  title={`Page ${p}${signatures.some(s => s.page === p) ? ' (has signatures)' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return arrayBufferToBase64(new Uint8Array(buffer));
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
