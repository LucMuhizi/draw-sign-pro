import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  onFileSelect?: (file: File) => void;
}

export const DocumentUpload = ({ onFileSelect }: DocumentUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === "application/pdf" || file.type.startsWith("image/")) {
          setSelectedFile(file);
          onFileSelect?.(file);
          toast.success("Document uploaded successfully!");
        } else {
          toast.error("Please upload a PDF or image file");
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect?.(file);
      toast.success("Document uploaded successfully!");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all",
          isDragging
            ? "border-primary bg-accent"
            : "border-border bg-card hover:border-primary/50"
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Upload a document
            </h3>
            <p className="text-sm text-muted-foreground">
              Drag and drop or browse to upload a PDF or image
            </p>
          </div>

          {selectedFile && (
            <div className="text-sm text-primary font-medium">
              Selected: {selectedFile.name}
            </div>
          )}

          <input
            type="file"
            id="file-upload"
            accept=".pdf,image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <label htmlFor="file-upload">
            <Button type="button" className="bg-primary hover:bg-primary-hover text-primary-foreground">
              Browse Files
            </Button>
          </label>
        </div>
      </div>
    </div>
  );
};
