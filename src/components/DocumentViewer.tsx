import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SignaturePlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface DocumentViewerProps {
  file: File;
  signature?: string;
  onBack?: () => void;
  onSignaturePlaced?: (count: number) => void;
}

export const DocumentViewer = ({ file, signature, onBack, onSignaturePlaced }: DocumentViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [signatures, setSignatures] = useState<SignaturePlacement[]>([]);
  const [draggingSignature, setDraggingSignature] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isImage, setIsImage] = useState(false);
  const [pageWidth, setPageWidth] = useState<number>(800);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setIsImage(file.type.startsWith("image/"));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Update page rendering width based on container or window size so PDF fits on small screens
  useEffect(() => {
    const updateWidth = () => {
      const parent = containerRef.current;
      const padding = 32; // account for container padding
      let w = 800;
      if (parent) {
        w = parent.clientWidth - padding;
      } else if (typeof window !== 'undefined') {
        w = Math.min(800, window.innerWidth - padding);
      }
      // clamp width to a sensible range
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
    toast.success("Signature added! Drag to position it.");
    // notify parent that a signature placeholder was added
    onSignaturePlaced?.(next.length);
  };

  // Pointer-based dragging & click-to-place
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

    // If user clicks on empty area and there are existing placeholder signatures,
    // place the most recently added placeholder at the click position. If there
    // are no placeholders but a signature image exists, create & place a new one.
    if (signatures.length > 0) {
      const last = signatures[signatures.length - 1];
      const x = Math.max(0, Math.min(e.clientX - rect.left - last.width / 2, rect.width - last.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top - last.height / 2, rect.height - last.height));
      setSignatures(signatures.map((s, i) => i === signatures.length - 1 ? { ...s, x, y } : s));
      onSignaturePlaced?.(signatures.length);
      return;
    }

    // No placeholders present: create & place a new signature if a signature image exists
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
    if (!draggingSignature || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sig = signatures.find((s) => s.id === draggingSignature);
    if (!sig) return;

    const x = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - sig.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - sig.height));

    setSignatures(signatures.map((s) => s.id === draggingSignature ? { ...s, x, y } : s));
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    setDraggingSignature(null);
    if (e && (e.target as Element).releasePointerCapture) {
      try { (e.target as Element).releasePointerCapture((e as any).pointerId); } catch {}
    }
  };

  const removeSignature = (sigId: string) => {
    setSignatures(signatures.filter((sig) => sig.id !== sigId));
    toast.success("Signature removed");
  };

  const downloadSignedDocument = async () => {
    if (!containerRef.current) return;

    try {
      toast.loading("Generating signed document...");
      // Temporarily update live DOM styles to hide UI and remove borders so
      // html2canvas captures the actual rendered PDF content and signatures.
      const src = containerRef.current! as HTMLElement;
      const original = {
        background: src.style.background,
        border: src.style.border,
        borderRadius: src.style.borderRadius,
        overflow: src.style.overflow,
      };

      const hiddenButtons: Array<{ el: HTMLElement; display: string }> = [];
      src.querySelectorAll('button').forEach((b) => {
        const be = b as HTMLElement;
        hiddenButtons.push({ el: be, display: be.style.display });
        be.style.display = 'none';
      });

      const hiddenToolbars: Array<{ el: HTMLElement; display: string }> = [];
      src.querySelectorAll('[role="toolbar"]').forEach((el) => {
        const ee = el as HTMLElement;
        hiddenToolbars.push({ el: ee, display: ee.style.display });
        ee.style.display = 'none';
      });

      const imgStyles: Array<{ el: HTMLImageElement; border: string; background: string; boxShadow: string }> = [];
      src.querySelectorAll('img').forEach((img) => {
        const ie = img as HTMLImageElement;
        imgStyles.push({ el: ie, border: ie.style.border, background: ie.style.background, boxShadow: ie.style.boxShadow });
        ie.style.border = 'none';
        ie.style.background = 'transparent';
        ie.style.boxShadow = 'none';
      });

      // Apply container styles for export
      src.style.background = '#ffffff';
      src.style.border = 'none';
      src.style.borderRadius = '0';
      src.style.overflow = 'visible';

      // Render canvas from live DOM
      const canvas = await html2canvas(src, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        allowTaint: false,
      });

      // Restore original styles
      src.style.background = original.background;
      src.style.border = original.border;
      src.style.borderRadius = original.borderRadius;
      src.style.overflow = original.overflow;

      hiddenButtons.forEach(({ el, display }) => (el.style.display = display));
      hiddenToolbars.forEach(({ el, display }) => (el.style.display = display));
      imgStyles.forEach(({ el, border, background, boxShadow }) => {
        el.style.border = border;
        el.style.background = background;
        el.style.boxShadow = boxShadow;
      });

      const isNative = Capacitor.isNativePlatform();
      const fileName = `signed-${file.name.replace(/\.[^/.]+$/, "")}`;

      if (isImage) {
        // For images, convert canvas to base64
        canvas.toBlob(async (blob) => {
          if (!blob) {
            toast.error("Failed to generate image");
            return;
          }

          if (isNative) {
            try {
              // Convert blob to base64
              const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64String = reader.result as string;
                  // Remove data URL prefix (data:image/png;base64,)
                  const base64Data = base64String.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              const fileExtension = file.name.split('.').pop() || 'png';
              const fileNameWithExt = `${fileName}.${fileExtension}`;

              // Save to Documents directory
              const result = await Filesystem.writeFile({
                path: fileNameWithExt,
                data: base64Data,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
              });

              const filePath = result.uri;
              
              // Show success with file path
              toast.success(`Document saved to Documents folder!\nPath: ${filePath}`, {
                duration: 8000,
              });
            } catch (error) {
              console.error("Filesystem error:", error);
              toast.error(`Failed to save file: ${error}`);
            }
          } else {
            // Browser fallback
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `signed-${file.name}`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('Document downloaded!');
          }
        }, file.type || 'image/png');
      } else {
        // For PDFs, create a new PDF with signatures
        const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
        const imgData = canvas.toDataURL('image/png');
        const pageWidth = 210; // A4 width in mm
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        if (isNative) {
          try {
            // Convert PDF to base64
            const pdfBlob = pdf.output('blob');
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = reader.result as string;
                // Remove data URL prefix
                const base64Data = base64String.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(pdfBlob);
            });

            const fileNameWithExt = `${fileName}.pdf`;

            // Save to Documents directory
            const result = await Filesystem.writeFile({
              path: fileNameWithExt,
              data: base64Data,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
            });

            const filePath = result.uri;
            
            // Show success with file path
            toast.success(`Document saved to Documents folder!\nPath: ${filePath}`, {
              duration: 8000,
            });
          } catch (error) {
            console.error("Filesystem error:", error);
            toast.error(`Failed to save file: ${error}`);
          }
        } else {
          // Browser fallback
          pdf.save(`${fileName}.pdf`);
          toast.success('Document downloaded!');
        }
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h2 className="text-xl font-bold text-foreground">{file.name}</h2>
        <Button onClick={downloadSignedDocument} className="bg-primary hover:bg-primary-hover">
          <Download className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          {!isImage && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          <Button onClick={addSignature} disabled={!signature}>
            Add Signature
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative bg-accent/30 rounded-lg overflow-hidden"
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

      {signatures
            .filter((sig) => isImage || sig.page === currentPage)
            .map((sig) => (
              <div
                key={sig.id}
                className="absolute group"
                style={{
                  left: sig.x,
                  top: sig.y,
                  width: sig.width,
                  height: sig.height,
                }}
                onPointerDown={(e) => handlePointerDown(e, sig.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <img
                  src={signature}
                  alt="Signature"
                  className="w-full h-full object-contain bg-background/90"
                  draggable={false}
                />
                <button
                  onClick={() => { 
                    const newSigs = signatures.filter((s) => s.id !== sig.id);
                    setSignatures(newSigs);
                    toast.success("Signature removed");
                    onSignaturePlaced?.(newSigs.length);
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
};
