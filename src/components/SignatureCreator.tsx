import { useState, useRef } from "react";
import { Camera, Upload, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { Camera as CapCamera } from "@capacitor/camera";
import { CameraResultType, CameraSource } from "@capacitor/camera";
import { removeBackground, loadImage } from "@/lib/backgroundRemoval";

interface SignatureCreatorProps {
  onSignatureCreate?: (signature: string) => void;
}

export const SignatureCreator = ({ onSignatureCreate }: SignatureCreatorProps) => {
  const [method, setMethod] = useState<"draw" | "photo" | "upload" | null>(null);
  const [signature, setSignature] = useState<string>("");
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleDraw = () => {
    setMethod("draw");
  };

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
    try {
      toast.loading("Removing background...");
      
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Load image and remove background
      const img = await loadImage(blob);
      const processedBlob = await removeBackground(img);
      
      // Convert back to data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setSignature(result);
        onSignatureCreate?.(result);
        toast.success("Signature processed successfully!");
      };
      reader.readAsDataURL(processedBlob);
    } catch (error) {
      console.error("Background removal error:", error);
      toast.error("Failed to process image. Using original.");
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

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Create Signature</h2>
        <p className="text-muted-foreground">Choose how you'd like to create your signature</p>
      </div>

      {!method && (
        <div className="space-y-3">
          <Card
            className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-soft transition-shadow"
            onClick={handleDraw}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <PenTool className="w-5 h-5 text-primary" />
            </div>
            <span className="font-medium text-foreground">Draw</span>
          </Card>

          <Card
            className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-soft transition-shadow"
            onClick={handleTakePhoto}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <span className="font-medium text-foreground">Take Photo</span>
          </Card>

          <label htmlFor="signature-upload">
            <Card className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-soft transition-shadow">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium text-foreground">Upload from Gallery</span>
            </Card>
          </label>
          <input
            type="file"
            id="signature-upload"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      )}

      {method === "draw" && (
        <div className="space-y-4">
          <Card className="p-4 bg-accent/50">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "w-full h-48 bg-background rounded-lg border border-border",
              }}
            />
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClearDrawing} className="flex-1">
              Clear
            </Button>
            <Button onClick={handleSaveDrawing} className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground">
              Save
            </Button>
          </div>
        </div>
      )}

      {signature && (
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Signature Preview</h3>
          <p className="text-xs text-muted-foreground mb-3">Your signature will appear here</p>
          <div className="bg-accent/30 rounded-lg p-4 flex items-center justify-center min-h-[120px]">
            <img src={signature} alt="Signature" className="max-w-full max-h-32 object-contain" />
          </div>
        </Card>
      )}

      {method && (
        <Button
          variant="outline"
          onClick={() => setMethod(null)}
          className="w-full"
        >
          Back
        </Button>
      )}
    </div>
  );
};
