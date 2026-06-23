import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/BottomSheet";
import { RotateCw, RotateCcw, Check, X } from "lucide-react";

interface ImageCropDialogProps {
  imageUrl: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export const ImageCropDialog = ({ imageUrl, onConfirm, onCancel }: ImageCropDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setCrop({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleRotate = (dir: 1 | -1) => {
    setRotation(r => (r + dir * 90) % 360);
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scaleX = crop.w / rect.width;
    const scaleY = crop.h / rect.height;
    setDragStart({ x: x * scaleX, y: y * scaleY });
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = crop.w / rect.width;
    const scaleY = crop.h / rect.height;
    const dx = (clientX - rect.left) * scaleX - dragStart.x;
    const dy = (clientY - rect.top) * scaleY - dragStart.y;
    setCrop(c => ({
      x: Math.max(0, Math.min(imgSize.w - c.w, c.x + dx)),
      y: Math.max(0, Math.min(imgSize.h - c.h, c.y + dy)),
      w: c.w,
      h: c.h,
    }));
  }, [isDragging, dragStart, crop.w, crop.h, imgSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imgRef.current;
    if (!img) return;
    const maxDim = 1600;
    const finalW = Math.min(crop.w, maxDim);
    const finalH = Math.min(crop.h, maxDim);
    canvas.width = finalW;
    canvas.height = finalH;
    ctx.save();
    if (rotation) {
      ctx.translate(finalW / 2, finalH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-finalW / 2, -finalH / 2);
    }
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, finalW, finalH);
    ctx.restore();
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, 'image/jpeg', 0.92);
  };

  const displayW = Math.min(imgSize.w, 300);
  const displayH = (imgSize.h / imgSize.w) * displayW;
  const scale = displayW / imgSize.w;

  return (
    <>
      <BottomSheet
        open={true}
        onOpenChange={onCancel}
        title="Crop Document"
        hideClose
      >
        <div className="flex justify-end mb-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleRotate(-1)} className="h-8 w-8 p-0 rounded-xl">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleRotate(1)} className="h-8 w-8 p-0 rounded-xl">
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl bg-muted mx-auto"
          style={{ width: displayW, height: displayH }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop preview"
            className="absolute"
            style={{
              width: displayW,
              height: displayH,
              transform: `rotate(${rotation}deg)`,
              objectFit: 'cover',
            }}
            draggable={false}
          />
          <div
            className="absolute border-2 border-primary bg-primary/10 cursor-move"
            style={{
              left: crop.x * scale,
              top: crop.y * scale,
              width: crop.w * scale,
              height: crop.h * scale,
            }}
          />
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl">
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1 bg-gradient-to-r from-primary to-secondary text-white rounded-xl">
            <Check className="w-4 h-4 mr-1" />
            Confirm
          </Button>
        </div>
      </BottomSheet>
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
};
