import { useState, useRef } from "react";
import { Camera, Upload, PenTool, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { Camera as CapCamera } from "@capacitor/camera";
import { CameraResultType, CameraSource } from "@capacitor/camera";
import { removeBackground, loadImage } from "@/lib/backgroundRemoval";
import { useSignatures, type SavedSignature } from "@/lib/signatureStorage";
import { motion, AnimatePresence } from "framer-motion";

interface SignatureCreatorProps {
  onSignatureCreate?: (signature: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
};

export const SignatureCreator = ({ onSignatureCreate }: SignatureCreatorProps) => {
  const [method, setMethod] = useState<"draw" | "photo" | "upload" | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [saveLabel, setSaveLabel] = useState("");
  const sigCanvas = useRef<SignatureCanvas>(null);
  const { signatures: savedSignatures, addSignature, deleteSignature } = useSignatures();

  const handleDraw = () => setMethod("draw");
  const handlePhoto = () => setMethod("photo");

  const handleTakePhoto = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        await processImageWithBackgroundRemoval(image.dataUrl);
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Camera access failed. Please use upload instead.");
    }
  };

  const processImageWithBackgroundRemoval = async (dataUrl: string) => {
    const toastId = toast.loading("Removing background...");

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const img = await loadImage(blob);
      const processedBlob = await removeBackground(img);

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setSignature(result);
        onSignatureCreate?.(result);
        toast.success("Signature processed successfully!", { id: toastId });
      };
      reader.readAsDataURL(processedBlob);
    } catch (error) {
      console.error("Background removal error:", error);
      toast.error("Failed to process image. Using original.", { id: toastId });
      setSignature(dataUrl);
      onSignatureCreate?.(dataUrl);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        await processImageWithBackgroundRemoval(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearDrawing = () => {
    sigCanvas.current?.clear();
    setSignature("");
  };

  const handleSaveDrawing = () => {
    if (sigCanvas.current) {
      const dataUrl = sigCanvas.current.toDataURL();
      setSignature(dataUrl);
      onSignatureCreate?.(dataUrl);
      toast.success("Signature saved!");
    }
  };

  const handleSelectSaved = (saved: SavedSignature) => {
    setSignature(saved.dataUrl);
    onSignatureCreate?.(saved.dataUrl);
    toast.success(`Using "${saved.label}"`);
  };

  const handleSaveToLibrary = () => {
    const label = saveLabel.trim() || `Signature ${savedSignatures.length + 1}`;
    addSignature(signature, label);
    setSaveLabel("");
    toast.success(`Signature "${label}" saved to library!`);
  };

  const isCurrentSaved = savedSignatures.some(s => s.dataUrl === signature);

  const handleDeleteSaved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSignature(id);
    toast.success("Signature removed from library");
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md mx-auto p-6 space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Create Signature</h1>
        <p className="text-muted-foreground text-sm mt-2">Choose how you'd like to create your signature</p>
      </motion.div>

      {savedSignatures.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">My Signatures</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {savedSignatures.map((saved) => (
              <motion.div
                key={saved.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectSaved(saved)}
                className={`relative flex-shrink-0 w-32 h-16 rounded-xl border-2 cursor-pointer transition-all p-1 flex items-center justify-center ${
                  signature === saved.dataUrl
                    ? 'border-primary bg-primary/5 shadow-glow'
                    : 'border-border hover:border-primary/50 bg-card/50 backdrop-blur-sm'
                }`}
              >
                <img
                  src={saved.dataUrl}
                  alt={saved.label}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
                {signature === saved.dataUrl && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-glow">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <button
                  onClick={(e) => handleDeleteSaved(e, saved.id)}
                  className="absolute -top-2 -left-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 hover:opacity-100 transition-all flex items-center justify-center shadow-md"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {!method ? (
          <motion.div
            key="methods"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Card
                  className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-soft transition-all duration-200 bg-white/60 backdrop-blur-xl border border-border hover:border-primary/40 group"
                  onClick={handleDraw}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <PenTool className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">Draw</span>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Card
                  className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-soft transition-all duration-200 bg-white/60 backdrop-blur-xl border border-border hover:border-primary/40 group"
                  onClick={handlePhoto}
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                    <Camera className="w-5 h-5 text-secondary" />
                  </div>
                  <span className="font-medium text-foreground">Take Photo</span>
                </Card>
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <label htmlFor="signature-upload">
                  <Card className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-soft transition-all duration-200 bg-white/60 backdrop-blur-xl border border-border hover:border-accent/40 group">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <Upload className="w-5 h-5 text-accent" />
                    </div>
                    <span className="font-medium text-foreground">Upload from Gallery</span>
                  </Card>
                </label>
              </motion.div>
              <input
                type="file"
                id="signature-upload"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </motion.div>
          </motion.div>
        ) : method === "draw" ? (
          <motion.div
            key="draw"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <Card className="p-4 bg-white/60 backdrop-blur-xl border border-border">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: "w-full h-48 bg-background rounded-xl border border-border",
                }}
              />
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClearDrawing} className="flex-1 rounded-xl">
                Clear
              </Button>
              <Button onClick={handleSaveDrawing} className="flex-1 bg-gradient-to-r from-primary to-secondary text-white shadow-soft rounded-xl">
                Save
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="photo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-border p-4 flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium mb-3">Take a Photo</h3>
              <div className="w-full max-w-2xl h-64 bg-black/60 rounded-lg overflow-hidden flex items-center justify-center">
                {signature ? (
                  <img src={signature} alt="Signature Preview" className="max-h-full object-contain" />
                ) : (
                  <div className="text-sm text-muted-foreground">No photo yet</div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleTakePhoto} className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft rounded-xl">Open Camera</Button>
                <label htmlFor="signature-upload" className="cursor-pointer">
                  <Button variant="outline" className="rounded-xl">Upload Photo</Button>
                </label>
                <input type="file" id="signature-upload" accept="image/*" onChange={handleUpload} className="hidden" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">Background is removed automatically</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {signature && !method && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-6 bg-white/60 backdrop-blur-xl border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Active Signature</h3>
              </div>
              <div className="bg-background/50 rounded-xl p-4 flex items-center justify-center min-h-[120px] border border-border">
                <img src={signature} alt="Signature" className="max-w-full max-h-40 object-contain" />
              </div>
              {!isCurrentSaved && (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder="Label (e.g. My Signature)"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  />
                  <Button onClick={handleSaveToLibrary} className="w-full" variant="outline">
                    Save to My Signatures
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {method && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="outline"
              onClick={() => {
                setMethod(null);
                if (!signature) setSignature("");
              }}
              className="w-full"
            >
              Back to Methods
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
