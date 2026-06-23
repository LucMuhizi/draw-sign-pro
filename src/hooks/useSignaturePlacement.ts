import { useState, useRef, useCallback } from "react";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { getProfile } from "@/lib/userProfile";
import type { SignaturePlacement, FieldType } from "@/lib/pdfSigner";

export interface UseSignaturePlacementOptions {
  signature?: string;
  currentPage: number;
  onSignaturePlaced?: (count: number) => void;
  /** Multi-party: current recipient ID to stamp on new placements */
  currentRecipientId?: string;
}

export function useSignaturePlacement({
  signature,
  currentPage,
  onSignaturePlaced,
  currentRecipientId,
}: UseSignaturePlacementOptions) {
  const [signatures, setSignatures] = useState<SignaturePlacement[]>([]);
  const [draggingSignature, setDraggingSignature] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingSignature, setResizingSignature] = useState<string | null>(null);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const pinchRef = useRef<{ sigId: string; dist: number; w: number; h: number } | null>(null);

  const getContainerRect = useCallback((container: HTMLDivElement) => container.getBoundingClientRect(), []);

  const addSignature = useCallback(() => {
    if (!signature) return;
    const newSig: SignaturePlacement = {
      id: `sig-${Date.now()}`,
      x: 100,
      y: 100,
      width: 150,
      height: 60,
      page: currentPage,
      fieldType: "signature",
      recipientId: currentRecipientId,
    };
    const next = [...signatures, newSig];
    setSignatures(next);
    hapticSuccess();
    onSignaturePlaced?.(next.length);
  }, [signature, currentPage, signatures, onSignaturePlaced, currentRecipientId]);

  const addField = useCallback(
    (fieldType: FieldType, typedText = "", dateFormat = "MM/DD/YYYY") => {
      const dimensions: Record<FieldType, [number, number]> = {
        signature: [150, 60],
        typed: [200, 50],
        date: [140, 40],
        initials: [80, 50],
        checkbox: [30, 30],
      };
      const [w, h] = dimensions[fieldType];
      const newSig: SignaturePlacement = {
        id: `sig-${Date.now()}`,
        x: 100,
        y: 100,
        width: w,
        height: h,
        page: currentPage,
        fieldType,
        typedText: fieldType === "typed" || fieldType === "initials" ? typedText : undefined,
        dateFormat: fieldType === "date" ? dateFormat : undefined,
        checked: fieldType === "checkbox" ? false : undefined,
        recipientId: currentRecipientId,
      };
      const next = [...signatures, newSig];
      setSignatures(next);
      hapticSuccess();
      onSignaturePlaced?.(next.length);
    },
    [currentPage, signatures, onSignaturePlaced, currentRecipientId],
  );

  const addSignatureAtPosition = useCallback(
    (x: number, y: number, width = 150, height = 60, fieldType: FieldType = "signature", typedText = "") => {
      if (!signature && fieldType === "signature") return;
      const newSig: SignaturePlacement = {
        id: `sig-${Date.now()}`,
        x,
        y,
        width: Math.min(width, 200),
        height: Math.min(height, 80),
        page: currentPage,
        fieldType,
        typedText: fieldType === "typed" || fieldType === "initials" ? typedText : undefined,
        checked: fieldType === "checkbox" ? false : undefined,
        recipientId: currentRecipientId,
      };
      const next = [...signatures, newSig];
      setSignatures(next);
      hapticSuccess();
      onSignaturePlaced?.(next.length);
    },
    [signature, currentPage, signatures, onSignaturePlaced, currentRecipientId],
  );

  const removeSignature = useCallback(
    (sigId: string) => {
      const newSigs = signatures.filter((s) => s.id !== sigId);
      setSignatures(newSigs);
      hapticLight();
      onSignaturePlaced?.(newSigs.length);
    },
    [signatures, onSignaturePlaced],
  );

  const toggleCheckbox = useCallback(
    (sigId: string) => {
      setSignatures((sigs) =>
        sigs.map((s) => (s.id === sigId && s.fieldType === "checkbox" ? { ...s, checked: !s.checked } : s)),
      );
      // We can't read the new `checked` value inside this updater without a
      // second pass; fire a "light tick" for toggle-off and a stronger
      // "success" tick for toggle-on, which matches the Phase-2 completion
      // pulse contract.
      const nextChecked = !signatures.find((s) => s.id === sigId)?.checked;
      if (nextChecked) hapticSuccess();
      else hapticLight();
    },
    [signatures],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, container: HTMLDivElement, sigId?: string) => {
      const rect = getContainerRect(container);

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
        setSignatures(signatures.map((s, i) => (i === signatures.length - 1 ? { ...s, x, y } : s)));
        onSignaturePlaced?.(signatures.length);
        return;
      }

      if (signature) {
        const newSig: SignaturePlacement = {
          id: `sig-${Date.now()}`,
          x: Math.max(0, Math.min(e.clientX - rect.left - 75, rect.width - 150)),
          y: Math.max(0, Math.min(e.clientY - rect.top - 30, rect.height - 60)),
          width: 150,
          height: 60,
          page: currentPage,
          fieldType: "signature",
          recipientId: currentRecipientId,
        };
        const next = [...signatures, newSig];
        setSignatures(next);
        onSignaturePlaced?.(next.length);
      }
    },
    [signatures, signature, currentPage, onSignaturePlaced, getContainerRect, currentRecipientId],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent, container: HTMLDivElement) => {
      const rect = getContainerRect(container);
      if (draggingSignature) {
        const sig = signatures.find((s) => s.id === draggingSignature);
        if (!sig) return;
        const x = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - sig.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - sig.height));
        setSignatures(signatures.map((s) => (s.id === draggingSignature ? { ...s, x, y } : s)));
        return;
      }
      if (resizingSignature && resizeCorner) {
        const sig = signatures.find((s) => s.id === resizingSignature);
        if (!sig) return;
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        let newW = resizeStart.w, newH = resizeStart.h, newX = sig.x, newY = sig.y;
        if (resizeCorner.includes("r")) newW = Math.max(20, resizeStart.w + dx);
        if (resizeCorner.includes("l")) { newW = Math.max(20, resizeStart.w - dx); newX = sig.x + (resizeStart.w - newW); }
        if (resizeCorner.includes("b")) newH = Math.max(15, resizeStart.h + dy);
        if (resizeCorner.includes("t")) { newH = Math.max(15, resizeStart.h - dy); newY = sig.y + (resizeStart.h - newH); }
        setSignatures(signatures.map((s) => s.id === resizingSignature ? { ...s, x: newX, y: newY, width: newW, height: newH } : s));
      }
    },
    [draggingSignature, dragOffset, resizingSignature, resizeCorner, resizeStart, signatures, getContainerRect],
  );

  const handlePointerUp = useCallback((e?: React.PointerEvent) => {
    setDraggingSignature(null);
    setResizingSignature(null);
    setResizeCorner(null);
    if (e && (e.target as Element).releasePointerCapture) (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, sigId: string, corner: string) => {
    e.stopPropagation();
    const sig = signatures.find((s) => s.id === sigId);
    if (!sig) return;
    setResizingSignature(sigId);
    setResizeCorner(corner);
    setResizeStart({ x: e.clientX, y: e.clientY, w: sig.width, h: sig.height });
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [signatures]);

  const handleTouchStart = useCallback((e: React.TouchEvent, sigId: string) => {
    if (e.touches.length === 2) {
      e.preventDefault(); e.stopPropagation();
      const sig = signatures.find((s) => s.id === sigId);
      if (!sig) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { sigId, dist: Math.sqrt(dx * dx + dy * dy), w: sig.width, h: sig.height };
      setDraggingSignature(null);
    }
  }, [signatures]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchRef.current.dist;
      setSignatures((sigs) =>
        sigs.map((s) => s.id === pinchRef.current?.sigId ? { ...s, width: Math.max(20, Math.round(pinchRef.current.w * scale)), height: Math.max(15, Math.round(pinchRef.current.h * scale)) } : s),
      );
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pinchRef.current) { hapticLight(); pinchRef.current = null; }
  }, []);

  /**
   * Auto-place a signature at the user's preferred position (or smart default).
   * Used by the one-tap Quick Sign workflow.
   * @param sigDataUrl - The signature PNG data URL
   * @param containerWidth - The actual container width in pixels (for right-alignment)
   */
  const autoPlaceDefault = useCallback(
    async (sigDataUrl: string, containerWidth = 800) => {
      if (!sigDataUrl) return;
      const profile = await getProfile();
      const pos = profile.preferredPosition;
      // Convert right-aligned negative x to absolute position using actual container width
      const x = pos.x < 0 ? Math.max(0, containerWidth + pos.x - pos.width) : pos.x;

      const newSig: SignaturePlacement = {
        id: `sig-${Date.now()}`,
        x: Math.max(0, x),
        y: Math.max(0, pos.y),
        width: pos.width || 200,
        height: pos.height || 60,
        page: currentPage,
        fieldType: "signature",
      };
      const next = [newSig];
      setSignatures(next);
      hapticSuccess();
      onSignaturePlaced?.(next.length);
    },
    [currentPage, onSignaturePlaced],
  );

  return {
    signatures,
    setSignatures,
    draggingSignature,
    resizingSignature,
    resizeCorner,
    addSignature,
    addField,
    addSignatureAtPosition,
    removeSignature,
    toggleCheckbox,
    autoPlaceDefault,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizeStart,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
