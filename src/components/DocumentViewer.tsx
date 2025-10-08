import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setIsImage(file.type.startsWith("image/"));
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
      
      if (isImage) {
        // For images, capture as PNG
        const canvas = await html2canvas(containerRef.current, {
          scale: 2,
          useCORS: true,
        });
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `signed-${file.name}`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("Document downloaded!");
          }
        });
      } else {
        // For PDFs, create a new PDF with signatures
        const pdf = new jsPDF();
        const canvas = await html2canvas(containerRef.current, {
          scale: 2,
          useCORS: true,
        });
        
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        pdf.save(`signed-${file.name}`);
        toast.success("Document downloaded!");
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
          Download
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
            <img src={fileUrl} alt="Document" className="w-full h-auto" />
          ) : (
            <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
              <Page pageNumber={currentPage} width={800} />
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
