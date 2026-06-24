import { useState, useRef, useCallback, useEffect } from "react";
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

/**
 * Phase 1 P1.4 — Undo/redo for placement mutations.
 *
 * Strategy: snapshot ring buffer (cap 20). Each user-driven mutation
 * (add, remove, toggle, drag-start, resize-start, create-on-tap) pushes
 * the *current* state onto the history stack before applying the change.
 * Undo pops the most recent snapshot back as state and pushes the live
 * state to a parallel "redo" stack. Any new commit clears the redo stack
 * (classico ed).
 *
 * During a drag/resize we do NOT snapshot per pointermove — that would
 * fill history in one swipe. Instead, the snapshot is pushed once at the
 * start of the drag, so undo restores the field's pre-drag position.
 *
 * Keyboard:
 *   - Ctrl+Z / Cmd+Z     -> undo
 *   - Ctrl+Shift+Z / Cmd+Shift+Z, Ctrl+Y -> redo
 *   - Skipped when focus is in an input/textarea/contentEditable (so
 *     typing in the typed-field textbox still works).
 */
const HISTORY_CAP = 20;

function snapshot(sigs: SignaturePlacement[]): SignaturePlacement[] {
  // One-level deep copy is enough — SignaturePlacement is a flat record.
  return sigs.map((s) => ({ ...s }));
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

  // ---- Undo / redo state --------------------------------------------------
  // Refs hold the actual buffers synchronously. Two state variables mirror
  // their lengths so React knows when to re-render the toolbar buttons.
  const signaturesRef = useRef<SignaturePlacement[]>([]);
  useEffect(() => {
    signaturesRef.current = signatures;
  }, [signatures]);

  const historyRef = useRef<SignaturePlacement[][]>([]);
  const futureRef = useRef<SignaturePlacement[][]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const [futureLen, setFutureLen] = useState(0);

  /**
   * Push the current state onto the undo stack right before applying a
   * mutation. Bounded by HISTORY_CAP — older entries are dropped via
   * `shift()`. A new mutation clears the redo stack (classic ed).
   */
  const pushHistory = useCallback(() => {
    const prev = signaturesRef.current;
    const next = [...historyRef.current, snapshot(prev)];
    if (next.length > HISTORY_CAP) next.shift();
    historyRef.current = next;
    futureRef.current = [];
    setHistoryLen(next.length);
    setFutureLen(0);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return false;
    const restored = historyRef.current[historyRef.current.length - 1];
    const nextHistory = historyRef.current.slice(0, -1);
    const nextFuture = [...futureRef.current, snapshot(signaturesRef.current)];
    if (nextFuture.length > HISTORY_CAP) nextFuture.shift();
    historyRef.current = nextHistory;
    futureRef.current = nextFuture;
    setSignatures(restored);
    setHistoryLen(nextHistory.length);
    setFutureLen(nextFuture.length);
    hapticLight();
    onSignaturePlaced?.(restored.length);
    return true;
  }, [onSignaturePlaced]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false;
    const restored = futureRef.current[futureRef.current.length - 1];
    const nextFuture = futureRef.current.slice(0, -1);
    const nextHistory = [...historyRef.current, snapshot(signaturesRef.current)];
    if (nextHistory.length > HISTORY_CAP) nextHistory.shift();
    historyRef.current = nextHistory;
    futureRef.current = nextFuture;
    setSignatures(restored);
    setHistoryLen(nextHistory.length);
    setFutureLen(nextFuture.length);
    hapticLight();
    onSignaturePlaced?.(restored.length);
    return true;
  }, [onSignaturePlaced]);

  // Keep refs current so window keydown handler can call latest closures
  // without re-binding the listener on every keystroke.
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Skip when focused on an input/textbox so typing in the "typed name"
      // toolbar still works.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const getContainerRect = useCallback((container: HTMLDivElement) => container.getBoundingClientRect(), []);

  const addSignature = useCallback(() => {
    if (!signature) return;
    pushHistory();
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
    const next = [...signaturesRef.current, newSig];
    setSignatures(next);
    hapticSuccess();
    onSignaturePlaced?.(next.length);
  }, [signature, currentPage, onSignaturePlaced, currentRecipientId, pushHistory]);

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
      pushHistory();
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
      const next = [...signaturesRef.current, newSig];
      setSignatures(next);
      hapticSuccess();
      onSignaturePlaced?.(next.length);
    },
    [currentPage, onSignaturePlaced, currentRecipientId, pushHistory],
  );

  const addSignatureAtPosition = useCallback(
    (x: number, y: number, width = 150, height = 60, fieldType: FieldType = "signature", typedText = "") => {
      if (!signature && fieldType === "signature") return;
      pushHistory();
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
      const next = [...signaturesRef.current, newSig];
      setSignatures(next);
      hapticSuccess();
      onSignaturePlaced?.(next.length);
    },
    [signature, currentPage, onSignaturePlaced, currentRecipientId, pushHistory],
  );

  const removeSignature = useCallback(
    (sigId: string) => {
      pushHistory();
      const newSigs = signaturesRef.current.filter((s) => s.id !== sigId);
      setSignatures(newSigs);
      hapticLight();
      onSignaturePlaced?.(newSigs.length);
    },
    [onSignaturePlaced, pushHistory],
  );

  const toggleCheckbox = useCallback(
    (sigId: string) => {
      pushHistory();
      const sig = signaturesRef.current.find((s) => s.id === sigId);
      const nextChecked = !(sig?.checked);
      setSignatures((sigs) =>
        sigs.map((s) => (s.id === sigId && s.fieldType === "checkbox" ? { ...s, checked: nextChecked } : s)),
      );
      if (nextChecked) hapticSuccess();
      else hapticLight();
    },
    [pushHistory],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, container: HTMLDivElement, sigId?: string) => {
      const rect = getContainerRect(container);

      if (sigId) {
        const sig = signaturesRef.current.find((s) => s.id === sigId);
        if (!sig) return;
        pushHistory();
        setDraggingSignature(sigId);
        setDragOffset({ x: e.clientX - sig.x - rect.left, y: e.clientY - sig.y - rect.top });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }

      if (signaturesRef.current.length > 0) {
        pushHistory();
        const last = signaturesRef.current[signaturesRef.current.length - 1];
        const x = Math.max(0, Math.min(e.clientX - rect.left - last.width / 2, rect.width - last.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top - last.height / 2, rect.height - last.height));
        setSignatures(
          signaturesRef.current.map((s, i) =>
            i === signaturesRef.current.length - 1 ? { ...s, x, y } : s,
          ),
        );
        onSignaturePlaced?.(signaturesRef.current.length);
        return;
      }

      if (signature) {
        pushHistory();
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
        const next = [...signaturesRef.current, newSig];
        setSignatures(next);
        onSignaturePlaced?.(next.length);
      }
    },
    [signature, currentPage, onSignaturePlaced, getContainerRect, currentRecipientId, pushHistory],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent, container: HTMLDivElement) => {
      const rect = getContainerRect(container);
      if (draggingSignature) {
        const sig = signaturesRef.current.find((s) => s.id === draggingSignature);
        if (!sig) return;
        const x = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - sig.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - sig.height));
        setSignatures(
          signaturesRef.current.map((s) => (s.id === draggingSignature ? { ...s, x, y } : s)),
        );
        return;
      }
      if (resizingSignature && resizeCorner) {
        const sig = signaturesRef.current.find((s) => s.id === resizingSignature);
        if (!sig) return;
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        let newW = resizeStart.w, newH = resizeStart.h, newX = sig.x, newY = sig.y;
        if (resizeCorner.includes("r")) newW = Math.max(20, resizeStart.w + dx);
        if (resizeCorner.includes("l")) { newW = Math.max(20, resizeStart.w - dx); newX = sig.x + (resizeStart.w - newW); }
        if (resizeCorner.includes("b")) newH = Math.max(15, resizeStart.h + dy);
        if (resizeCorner.includes("t")) { newH = Math.max(15, resizeStart.h - dy); newY = sig.y + (resizeStart.h - newH); }
        setSignatures(
          signaturesRef.current.map((s) => s.id === resizingSignature ? { ...s, x: newX, y: newY, width: newW, height: newH } : s),
        );
      }
    },
    [draggingSignature, dragOffset, resizingSignature, resizeCorner, resizeStart, getContainerRect],
  );

  const handlePointerUp = useCallback((e?: React.PointerEvent) => {
    setDraggingSignature(null);
    setResizingSignature(null);
    setResizeCorner(null);
    if (e && (e.target as Element).releasePointerCapture) (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, sigId: string, corner: string) => {
    e.stopPropagation();
    const sig = signaturesRef.current.find((s) => s.id === sigId);
    if (!sig) return;
    pushHistory();
    setResizingSignature(sigId);
    setResizeCorner(corner);
    setResizeStart({ x: e.clientX, y: e.clientY, w: sig.width, h: sig.height });
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [pushHistory]);

  const handleTouchStart = useCallback((e: React.TouchEvent, sigId: string) => {
    if (e.touches.length === 2) {
      e.preventDefault(); e.stopPropagation();
      const sig = signaturesRef.current.find((s) => s.id === sigId);
      if (!sig) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { sigId, dist: Math.sqrt(dx * dx + dy * dy), w: sig.width, h: sig.height };
      setDraggingSignature(null);
    }
  }, []);

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

      pushHistory();
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
    [currentPage, onSignaturePlaced, pushHistory],
  );

  return {
    signatures,
    setSignatures,
    draggingSignature,
    resizingSignature,
    resizeCorner,
    historyLen,
    futureLen,
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
    undo,
    redo,
    canUndo: historyLen > 0,
    canRedo: futureLen > 0,
  };
}
