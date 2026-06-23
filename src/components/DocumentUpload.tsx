import { useState, useCallback } from "react";
import { Upload, FileUp, CheckCircle2, Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { scanDocument, isCameraAvailable } from "@/lib/cameraScan";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { DocumentScanner } from "@/components/DocumentScanner";
import { Capacitor } from "@capacitor/core";
import { CameraResultType, CameraSource } from "@capacitor/camera";
import { isDocxFile } from "@/lib/docxConverter";

interface DocumentUploadProps {
  onFileSelect?: (file: File) => void;
}

export const DocumentUpload = ({ onFileSelect }: DocumentUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = useCallback((file: File) => {
    setSelectedFile(file);
    onFileSelect?.(file);
    toast.success("Document uploaded successfully!");
  }, [onFileSelect]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/") || file.type === "application/pdf" || isDocxFile(file)) {
          processFile(file);
        } else {
          toast.error("Please upload a PDF, image, or Word document");
        }
      }
    },
    [processFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleScanDocument = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          correctOrientation: true,
        });
        if (photo.dataUrl) {
          setCapturedImage(photo.dataUrl);
          setShowCrop(true);
        }
      } catch (err: unknown) {
        if (err instanceof Error && !err.message.includes('cancel')) {
          toast.error("Camera access failed");
        }
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setCapturedImage(reader.result as string);
            setShowCrop(true);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const handleSmartScan = () => {
    setShowScanner(true);
  };

  const handleScanComplete = (file: File) => {
    setShowScanner(false);
    processFile(file);
  };

  const handleCropConfirm = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setCapturedImage(null);
    setShowCrop(false);
    processFile(file);
  };

  const handleCropCancel = () => {
    setCapturedImage(null);
    setShowCrop(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full max-w-md mx-auto p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Upload Document</h1>
        <p className="text-muted-foreground text-sm mt-2">Drag & drop, browse, or scan a document</p>
      </motion.div>

      <div className="flex gap-3 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 25 }}
          className="flex-1"
        >
          <Button
            onClick={handleSmartScan}
            className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all h-12 rounded-xl font-semibold"
          >
            <ScanLine className="w-5 h-5 mr-2" />
            Smart Scan
          </Button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, type: "spring", stiffness: 300, damping: 25 }}
          className="flex-1"
        >
          <Button
            onClick={handleScanDocument}
            className="w-full bg-gradient-to-r from-secondary to-accent text-white shadow-soft hover:shadow-glow transition-all h-12 rounded-xl font-semibold"
          >
            <Camera className="w-5 h-5 mr-2" />
            Quick Photo
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-2xl p-12 text-center transition-all duration-300 overflow-hidden",
          isDragging
            ? "bg-primary/5 shadow-glow"
            : "bg-white/60 backdrop-blur-xl hover:shadow-soft",
          "border-2 border-dashed",
          isDragging ? "border-primary" : "border-border hover:border-primary/40"
        )}
      >
        {isDragging && (
          <motion.div
            className="absolute inset-0 bg-primary/5 rounded-2xl"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        <div className="flex flex-col items-center gap-4 relative">
          <motion.div
            animate={isDragging ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300",
              isDragging ? "bg-primary/20" : "bg-primary/10"
            )}
          >
            <AnimatePresence mode="wait">
              {isDragging ? (
                <motion.div
                  key="fileup"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                >
                  <FileUp className="w-8 h-8 text-primary" />
                </motion.div>
              ) : selectedFile ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </motion.div>
              ) : (
                <motion.div key="upload" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Upload className="w-8 h-8 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key="filename"
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                {selectedFile.name}
              </motion.div>
            ) : (
              <motion.div
                key="prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-muted-foreground"
              >
                {isDragging ? "Drop your file here" : "PDF, Word, JPEG, PNG, WebP"}
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="file"
            id="file-upload"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <Button
            type="button"
            onClick={() => document.getElementById('file-upload')?.click()}
            className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all px-6 h-10 rounded-xl font-semibold"
          >
            {selectedFile ? "Choose Another File" : "Browse Files"}
          </Button>
        </div>
      </motion.div>

      {showCrop && capturedImage && (
        <ImageCropDialog
          imageUrl={capturedImage}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {showScanner && (
        <DocumentScanner
          onScanComplete={handleScanComplete}
          onCancel={() => setShowScanner(false)}
        />
      )}
    </motion.div>
  );
};
