import { useState, useCallback } from "react";
import { Scan, Scissors, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { scanDocumentWithEdges, enhanceImage } from "@/lib/documentScanner";
import { Capacitor } from "@capacitor/core";

interface DocumentScannerProps {
  onScanComplete: (file: File, enhanced: boolean) => void;
  onCancel: () => void;
}

export const DocumentScanner = ({ onScanComplete }: DocumentScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [isNative] = useState(Capacitor.isNativePlatform());

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const dataUrl = await scanDocumentWithEdges();

      if (!dataUrl) {
        setScanning(false);
        return;
      }

      const enhanced = await enhanceImage(dataUrl, 1.3);
      const blob = await (await fetch(enhanced)).blob();
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      toast.success("Document scanned!");

      if (!isNative) {
        onScanComplete(file, true);
        setScanning(false);
        return;
      }

      onScanComplete(file, true);
    } catch (err: unknown) {
      if (err instanceof Error && !err.message.includes('cancel')) {
        toast.error("Scan failed");
      }
    } finally {
      setScanning(false);
    }
  }, [onScanComplete, isNative]);

  const handleUploadAsScan = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setScanning(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const enhanced = await enhanceImage(dataUrl, 1.3);
        const blob = await (await fetch(enhanced)).blob();
        const newFile = new File([blob], file.name, { type: 'image/jpeg' });
        onScanComplete(newFile, true);
        setScanning(false);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [onScanComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Scan className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Scan Document</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-detect edges, correct perspective, enhance contrast
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleScan}
            disabled={scanning}
            className="w-full bg-gradient-to-r from-primary to-secondary text-white rounded-xl h-12"
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Scissors className="w-4 h-4" />
                </motion.div>
                Scanning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Scan className="w-4 h-4" />
                {isNative ? 'Open Scanner' : 'Take Photo'}
              </span>
            )}
          </Button>

          <Button
            onClick={handleUploadAsScan}
            disabled={scanning}
            variant="outline"
            className="w-full rounded-xl h-12"
          >
            <Contrast className="w-4 h-4 mr-2" />
            Upload & Enhance
          </Button>

          <Button variant="ghost" onClick={onCancel} className="w-full rounded-xl text-sm">
            Cancel
          </Button>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Contrast className="w-3 h-3" />
            Applies contrast enhancement + adaptive threshold
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
