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
}

export const DocumentViewer = ({ file, signature, onBack }: DocumentViewerProps) => {
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
    setSignatures([...signatures, newSignature]);
    toast.success("Signature added! Drag to position it.");
  };

  const handleMouseDown = (e: React.MouseEvent, sigId: string) => {
    const sig = signatures.find((s) => s.id === sigId);
    if (!sig) return;

    setDraggingSignature(sigId);
    setDragOffset({
      x: e.clientX - sig.x,
      y: e.clientY - sig.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingSignature || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - 150));
    const y = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - 60));

    setSignatures(
      signatures.map((sig) =>
        sig.id === draggingSignature ? { ...sig, x, y } : sig
      )
    );
  };

  const handleMouseUp = () => {
    setDraggingSignature(null);
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
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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
                className="absolute cursor-move group"
                style={{
                  left: sig.x,
                  top: sig.y,
                  width: sig.width,
                  height: sig.height,
                }}
                onMouseDown={(e) => handleMouseDown(e, sig.id)}
              >
                <img
                  src={signature}
                  alt="Signature"
                  className="w-full h-full object-contain border-2 border-primary rounded bg-background/90"
                  draggable={false}
                />
                <button
                  onClick={() => removeSignature(sig.id)}
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
