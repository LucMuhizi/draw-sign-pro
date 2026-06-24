import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, Download, Signature, ScanLine, Share2, Type, CheckSquare, Calendar, Bookmark, BookmarkCheck, FileText, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { hapticSuccess, hapticLight } from "@/lib/haptics";
import { useAuth } from "@/lib/AuthContext";
import { registerForPush } from "@/lib/pushNotifications";
import { saveDocumentRecord } from "@/lib/documentHistory";
import { detectSignatureFields, type DetectedField } from "@/lib/ocrFields";
import { downloadSignedDocument, shareSignedDocument } from "@/lib/documentActions";
import { useSignaturePlacement } from "@/hooks/useSignaturePlacement";
import { useIsTabletOrLarger } from "@/hooks/use-mobile";
import type { SignaturePlacement } from "@/lib/pdfSigner";

import { DocumentRenderer, PageNavigation } from "@/components/document-viewer/DocumentRenderer";
import { SignaturePlacementLayer } from "@/components/document-viewer/SignaturePlacementLayer";
import { PageThumbnailSidebar } from "@/components/document-viewer/PageThumbnailSidebar";
import { TabletSidebarPanel } from "@/components/document-viewer/TabletSidebarPanel";
import { SuccessBurst } from "@/components/animations/SuccessBurst";
import { DocumentFoldIn } from "@/components/animations/DocumentFoldIn";
import { getTemplates, saveTemplate, deleteTemplate, templateToPlacements, type DocumentTemplate } from "@/lib/templateStorage";
import { SkeletonDocumentPage } from "@/components/Skeleton";
import { convertDocxToHtml, wrapDocxHtml, isDocxFile } from "@/lib/docxConverter";
import { hashDocument, summarizeSignatureSession, normaliseSignerRole, type SignatureSummary } from "@/lib/auditTrail";
import { SignedSummaryDialog } from "@/components/SignedSummaryDialog";
import type { FieldType } from "@/lib/pdfSigner";
import type { SavedSignature } from "@/lib/signatureStorage";
import type { SigningParticipant } from "@/lib/multiPartySigning";

interface DocumentViewerProps {
  file: File;
  signature?: string;
  onBack?: () => void;
  onSignaturePlaced?: (count: number) => void;
  savedSignatures?: SavedSignature[];
  onSignatureChange?: (signature: string) => void;
  multiPartyParticipants?: SigningParticipant[];
  currentRecipientId?: string;
}

const FIELD_TYPES: { type: FieldType; icon: typeof Signature; label: string; needsText?: boolean }[] = [
  { type: "signature", icon: Signature, label: "Signature" },
  { type: "typed", icon: Type, label: "Typed Name" },
  { type: "date", icon: Calendar, label: "Date" },
  { type: "initials", icon: Type, label: "Initials" },
  { type: "checkbox", icon: CheckSquare, label: "Checkbox" },
];

export const DocumentViewer = ({
  file,
  signature,
  onBack,
  onSignaturePlaced,
  savedSignatures,
  onSignatureChange,
  multiPartyParticipants,
  currentRecipientId,
}: DocumentViewerProps) => {
  const { user } = useAuth();
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [fileUrl, setFileUrl] = useState("");
  const [isImage, setIsImage] = useState(false);
  const [isDocx, setIsDocx] = useState(false);
  const [docxHtml, setDocxHtml] = useState("");
  const [docxLoading, setDocxLoading] = useState(false);
  const [pageWidth, setPageWidth] = useState(800);
  // Phase 2 P2.4 — display height of the current page wrapper, used
  // to scale normalized range coords into pixel space. Tracks
  // pageWidth one-for-one via the existing ResizeObserver so a window
  // resize, keyboard show/hide, or device rotation all re-derive it
  // without an extra subscription.
  const [displayHeight, setDisplayHeight] = useState(0);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [activeFieldType, setActiveFieldType] = useState<FieldType>("signature");
  const [typedFieldText, setTypedFieldText] = useState("");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [successBurstActive, setSuccessBurstActive] = useState(false);
  // Phase 2 P2.1 — signing receipt shown after a successful download.
  // Kept separate from `successBurstActive` so the dialog survives a
  // second download without flashing closed.
  const [summary, setSummary] = useState<SignatureSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const docxContentRef = useRef<HTMLDivElement>(null);

  // Phase 5 — auto-advance camera.
  // `cameraScale` drives the document's brief "zoom out / zoom in" during
  // auto-advance. `lastPlacementCount` tracks how many fields existed before
  // the latest placement so we only trigger the camera on *new* additions
  // (not on checkbox toggles, drags, or template loads).
  const [cameraScale, setCameraScale] = useState(1);
  const lastPlacementCount = useRef(0);
  const cameraInFlight = useRef(false);
  const reduceMotion = useReducedMotion();

  const sigPlacement = useSignaturePlacement({ signature, currentPage, numPages, onSignaturePlaced, currentRecipientId });

  /**
   * Phase 2 P2.3 — `isTabletLayout` is true at >= 1024px (iPad / iPad Pro /
   * desktop). Above the breakpoint we render the split-canvas layout: a
   * wider main PDF canvas on the LEFT and a right-side panel for signers /
   * role legend / page thumbnails. Below it we keep the original
   * single-column layout (with the left-sidebar fallback for the small
   * tablet 768-1023 range).
   *
   * Returns `false` until the matchMedia effect first paints; we treat
   * the pre-paint window as mobile to avoid the "wrong layout for one
   * frame" flash you'd get if we used `!!useMediaQuery(...)` directly.
   */
  const isTabletLayout = useIsTabletOrLarger();

  // File URL lifecycle — handle docx conversion
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    const img = file.type.startsWith("image/");
    const docx = !img && isDocxFile(file);
    setIsImage(img);
    setIsDocx(docx);

    if (docx) {
      setDocxLoading(true);
      convertDocxToHtml(file)
        .then((result) => {
          // Extract body content from the wrapped HTML for inline rendering
          const wrapped = wrapDocxHtml(result.html, file.name);
          // Extract just the body innerHTML for dangerouslySetInnerHTML
          const bodyMatch = wrapped.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          setDocxHtml(bodyMatch ? bodyMatch[1] : result.html);
          if (result.warnings.length > 0) {
            console.warn("DOCX conversion warnings:", result.warnings);
          }
        })
        .catch((err) => {
          console.error("DOCX conversion error:", err);
          toast.error("Failed to convert Word document");
        })
        .finally(() => setDocxLoading(false));
    }

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Load templates on mount
  useEffect(() => { getTemplates().then(setTemplates); }, []);

  /**
   * Find the next detected field that isn't already covered by a placed
   * signature/field. Document order: page asc, then y asc, then x asc.
   */
  const findNextUncoveredField = useCallback(
    (signatures: SignaturePlacement[], detected: DetectedField[]): DetectedField | null => {
      if (detected.length === 0) return null;
      const sorted = [...detected].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
        return a.x - b.x;
      });
      return (
        sorted.find((f) => {
          const covered = signatures.some(
            (s) =>
              s.page === f.page &&
              s.x < f.x + f.width &&
              s.x + s.width > f.x &&
              s.y < f.y + f.height &&
              s.y + s.height > f.y,
          );
          return !covered;
        }) ?? null
      );
    },
    [],
  );

  /**
   * Phase 5 — auto-advance camera animation.
   * Zoom out slightly → pan to next field (scroll or page change) → zoom back in.
   * Skipped if reduced motion is on, if no detected fields remain uncovered, or
   * if a camera move is already in flight (rapid placements don't queue up).
   */
  const triggerAutoAdvance = useCallback(
    (nextField: DetectedField) => {
      if (reduceMotion || cameraInFlight.current) return;
      cameraInFlight.current = true;
      // 1) Zoom out
      setCameraScale(0.92);
      // 2) Pan at the midpoint
      window.setTimeout(() => {
        if (nextField.page !== currentPage) {
          setCurrentPage(nextField.page);
        } else if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const absoluteY = rect.top + window.scrollY + nextField.y + nextField.height / 2;
          const targetY = Math.max(0, absoluteY - window.innerHeight / 2);
          window.scrollTo({ top: targetY, behavior: "smooth" });
        }
        // 3) Zoom back in
        window.setTimeout(() => {
          setCameraScale(1);
          cameraInFlight.current = false;
        }, 220);
      }, 200);
    },
    [currentPage, reduceMotion],
  );

  // Watch signature count; trigger auto-advance when a new field is added.
  useEffect(() => {
    const count = sigPlacement.signatures.length;
    if (count > lastPlacementCount.current) {
      const next = findNextUncoveredField(sigPlacement.signatures, detectedFields);
      if (next) triggerAutoAdvance(next);
    }
    lastPlacementCount.current = count;
  }, [sigPlacement.signatures, detectedFields, findNextUncoveredField, triggerAutoAdvance]);

  // Responsive page width — drives <Page width={pageWidth} /> in DocumentRenderer.
  //
  // Why we render the canvas at the wrapper's EXACT clientWidth:
  //   The click overlay (SignaturePlacementLayer) is `absolute inset-0` over
  //   the wrapper, so pointer coords are recorded in wrapper-pixel space. The
  //   PDF export scales those coords by `pdfWidth / pageWidth` to land them on
  //   the saved page. If pageWidth < clientWidth (e.g. we subtracted padding
  //   for visual breathing room), the canvas sits left-aligned inside a wider
  //   wrapper and drags/clicks near the right edge land proportionally off
  //   in the exported PDF. On mobile this 32px gap is ~10% of a ~330px screen
  //   and is visibly misaligned. Setting pageWidth = clientWidth makes the
  //   canvas 1:1 with the overlay so coords round-trip cleanly.
  //
  // Why ResizeObserver:
  //   `window.resize` only fires on viewport resizes. On mobile, the wrapper
  //   also resizes when the virtual keyboard opens, when the device rotates
  //   (some browsers), and when internal Card content reflows (signature
  //   picker toggle, toolbar wrap). ResizeObserver picks all of those up so
  //   pageWidth stays in sync without a hard refresh.
  useEffect(() => {
    const updateWidth = () => {
      const parent = containerRef.current;
      // Phase 2 P2.3 — raised DESKTOP_CAP from 800 to 1100 so the PDF canvas
      // scales up proportionally on tablet/desktop. The split-canvas layout
      // reserves ~320px for the right panel + 16px gap, so the page column
      // has roughly viewport−336px of room; at iPad Pro (1366) that's
      // ~1030, at iPad (1024) that's ~688 (which the 280 floor catches).
      // The cap stays at 1100 because above that react-pdf allocates
      // >5 MB of canvas per page in our perf tests and scroll smoothness
      // regresses on lower-end hardware.
      const DESKTOP_CAP = 1100;
      const rightPanelWidth = isTabletLayout ? 320 : 0;
      const rightPanelGap = isTabletLayout ? 16 : 0;
      const FLOOR = 280;
      let w = 800;
      if (parent) {
        const viewportCap = typeof window !== "undefined" ? window.innerWidth : parent.clientWidth;
        const effectiveCap = Math.max(FLOOR, viewportCap - rightPanelWidth - rightPanelGap);
        w = Math.max(FLOOR, Math.min(DESKTOP_CAP, parent.clientWidth, effectiveCap));
      } else if (typeof window !== "undefined") {
        // Pre-mount fallback: mirror the post-mount philosophy (no padding
        // subtraction). Only reached on the very first render before refs
        // attach, which is a near-zero race in React 18.
        const effectiveCap = Math.max(FLOOR, window.innerWidth - rightPanelWidth - rightPanelGap);
        w = Math.max(FLOOR, Math.min(DESKTOP_CAP, effectiveCap));
      }
      setPageWidth(Math.round(w));
      // Phase 2 P2.4 — display height tracks the wrapper's clientHeight
      // for the same reason (canvas/PDF aspect ratio lands on the box
      // bounds, not on a stored constant). Equals 0 when the wrapper
      // has not yet rendered.
      setDisplayHeight(parent ? parent.clientHeight : 0);
    };
    updateWidth();
    let ro: ResizeObserver | undefined;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateWidth);
      ro.observe(containerRef.current);
    }
    window.addEventListener("resize", updateWidth);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
    // Re-run when the breakpoint flips so the page width caps correctly
    // for the new layout (otherwise users would see the old 800 cap until
    // they manually resized the window).
  }, [isTabletLayout]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    toast.success("Document loaded successfully!");
  };

  // Phase 2 P2.4 — when the user navigates pages with an in-progress
  // range draft, the destination page becomes the draft's endPage.
  // Effect (not setCurrentPage wrapper) so prev/next, dots, and the
  // thumbnail sidebar all converge on the same draft-update path.
  useEffect(() => {
    if (!sigPlacement.rangeMode || !sigPlacement.rangeDraft) return;
    if (sigPlacement.rangeDraft.endPage === currentPage) return;
    sigPlacement.setRangeDraft({ ...sigPlacement.rangeDraft, endPage: currentPage });
  }, [currentPage, sigPlacement]);

  // Phase 2 P2.4 — ESC cancels an in-progress draft. Skipped when
  // focus is in a textbox so typing in the typed-name toolbar still
  // works (mirrors the auditTrail-undo skip in useSignaturePlacement).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape" && sigPlacement.rangeDraft) {
        e.preventDefault();
        sigPlacement.cancelRangeDraft();
      }
      if (e.key === "Enter" && sigPlacement.rangeDraft) {
        e.preventDefault();
        sigPlacement.commitRangeDraft();
        hapticSuccess();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sigPlacement.rangeDraft, sigPlacement.cancelRangeDraft, sigPlacement.commitRangeDraft, sigPlacement]);

  // OCR field detection (PDF only)
  const handleDetectFields = async () => {
    setOcrLoading(true);
    try {
      const fields = await detectSignatureFields(file, pageWidth, numPages || undefined);
      setDetectedFields(fields);
      toast[fields.length > 0 ? "success" : "info"](fields.length > 0 ? `Found ${fields.length} field(s)` : "No signature fields detected");
    } catch (error) {
      console.error("OCR error:", error);
      toast.error("Failed to detect fields");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFieldClick = (field: DetectedField) => {
    if (!signature && activeFieldType === "signature") {
      toast.error("Please create a signature first");
      return;
    }
    sigPlacement.addSignatureAtPosition(field.x, field.y, field.width, field.height, activeFieldType);
    toast.success(`Placed at "${field.label}"`);
  };

  const handleAddField = () => {
    if (activeFieldType === "signature") {
      sigPlacement.addSignature();
    } else if (activeFieldType === "typed" || activeFieldType === "initials") {
      if (!typedFieldText.trim()) {
        toast.error("Please enter text for this field");
        return;
      }
      sigPlacement.addField(activeFieldType, typedFieldText.trim());
      setTypedFieldText("");
    } else {
      sigPlacement.addField(activeFieldType);
    }
  };

  /**
   * Phase 2 P2.4 — pointer-down handler used by both the PDF and the
   * docx paths so the page area inherits range-mode behaviour. When
   * range mode is active and no draft exists yet, the click becomes
   * the start anchor of a draft (no placement is created). When a
   * draft exists, additional clicks are ignored so the user uses
   * prev/next/thumb to set the end page and "Seal Range" to commit.
   */
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    if (sigPlacement.rangeMode && !sigPlacement.rangeDraft) {
      const rect = containerRef.current.getBoundingClientRect();
      const displayW = rect.width;
      const displayH = rect.height;
      if (displayW <= 0 || displayH <= 0) return;
      // Phase 2 P2.4 starts the range with a default-sized 150x60 box
      // centered on the press point. Width/height match the existing
      // signature default so the user gets the same affordance they
      // already know; a drag-to-resize step is omitted in this MVP
      // because range UX lives entirely in the toolbar.
      const width = 150;
      const height = 60;
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;
      const x = Math.max(0, Math.min(centerX - width / 2, displayW - width));
      const y = Math.max(0, Math.min(centerY - height / 2, displayH - height));
      sigPlacement.setRangeDraft({
        startPage: currentPage,
        endPage: currentPage,
        xNorm: x / displayW,
        yNorm: y / displayH,
        wNorm: width / displayW,
        hNorm: height / displayH,
        fieldType: activeFieldType,
        typedText: (activeFieldType === "typed" || activeFieldType === "initials") && typedFieldText.trim()
          ? typedFieldText.trim()
          : undefined,
        dateFormat: activeFieldType === "date" ? "MM/DD/YYYY" : undefined,
        recipientId: currentRecipientId,
      });
      hapticLight();
      toast.info(`Range start set on page ${currentPage}. Navigate or click "Seal Range" to finish.`);
      return;
    }
    // In normal single-placement mode, fall through to the existing
    // pointer-down handler for dragndrop placement.
    if (sigPlacement.rangeMode && sigPlacement.rangeDraft) return;
    sigPlacement.handlePointerDown(e, containerRef.current);
  };

  const handleSaveTemplate = async () => {
    const name = prompt("Template name:", file.name);
    if (!name) return;
    const tpl = await saveTemplate(name, file.name, numPages || 1, sigPlacement.signatures);
    setTemplates(prev => [tpl, ...prev]);
    hapticLight();
    toast.success(`Template "${name}" saved!`);
  };

  const handleLoadTemplate = async (template: DocumentTemplate) => {
    const placements = templateToPlacements(template);
    sigPlacement.setSignatures(placements);
    onSignaturePlaced?.(placements.length);
    hapticLight();
    toast.success(`Loaded ${placements.length} field(s) from "${template.name}"`);
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    await deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success(`Template "${name}" deleted`);
  };

  const handleDownload = async () => {
    if (!containerRef.current || !signature || sigPlacement.signatures.length === 0) return;
    const toastId = toast.loading("Generating signed document...");
    try {
      // Phase 2 P2.1 — measure the input hash once for PDF downloads,
      // thread it through downloadSignedDocument so the certificate
      // uses the same value (no double-hashing), then read both
      // `inputHash` + `outputHash` off the DownloadResult for the
      // receipt. Skip for image/docx since those branches discard
      // inputHash internally.
      const inputHash =
        !isImage && !isDocx ? await hashDocument(file).catch(() => "") : "";
      const result = await downloadSignedDocument({
        file, fileUrl, isImage, isDocx, signature,
        signatures: sigPlacement.signatures,
        pageWidth, numPages,
        containerElement: containerRef.current,
        inputHash,
      });
      toast.success("Document downloaded!", { id: toastId });
      hapticSuccess();
      setSuccessBurstActive(true);

      const built = summarizeSignatureSession({
        documentName: file.name,
        documentHash: result.inputHash || inputHash,
        outputHash: result.outputHash,
        signedAt: Date.now(),
        participants: multiPartyParticipants?.map((p) => ({
          id: p.id,
          email: p.email,
          name: p.name,
          // Use normaliseSignerRole so multi-party roles (`sender` /
          // `viewer`) collapse onto the receipt's canonical union
          // rather than passing through unchanged. SigningParticipant
          // doesn't carry a per-participant `signedAt`; the audit
          // trail lives on the underlying supabase row and the receipt
          // shows the session-wide timestamp instead.
          role: normaliseSignerRole(p.role),
        })),
        placements: sigPlacement.signatures,
        activeUser: user ? { id: user.id, email: user.email ?? "" } : undefined,
      });
      setSummary(built);
      setSummaryOpen(true);

      if (user?.id) saveDocumentRecord(user.id, file.name, numPages || 1, sigPlacement.signatures.length);
      registerForPush().catch(() => {});
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document", { id: toastId });
    }
  };

  const handleShare = async () => { await shareSignedDocument(fileUrl, file); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl lg:max-w-[120rem] mx-auto p-4 sm:p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="hover:bg-card">
          <ChevronLeft className="w-4 h-4 mr-1" />Back
        </Button>
        <h2 className="text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">{file.name}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleShare} className="hover:bg-card"><Share2 className="w-4 h-4" /></Button>
          <Button onClick={handleDownload} disabled={sigPlacement.signatures.length === 0} className="bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-soft hover:shadow-medium">
            <Download className="w-4 h-4 mr-1.5" />Save
          </Button>
        </div>
      </div>

      <DocumentFoldIn
        fileKey={`${file.name}-${file.size}-${file.lastModified}`}
      >
        <Card
          className="p-4 bg-card/50 backdrop-blur-sm border border-border shadow-soft"
          style={{
            // Phase 5 — auto-advance camera scale.
            transform: `scale(${cameraScale})`,
            transformOrigin: "center top",
            transition: "transform 200ms ease-out",
            willChange: "transform",
          }}
        >
        {/* Toolbar */}
        {!isDocx && (
          <>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              {!isImage && <PageNavigation currentPage={currentPage} numPages={numPages} onPageChange={setCurrentPage} />}
              <div className="flex items-center gap-2">
                {!isImage && numPages > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDetectFields} disabled={ocrLoading} className="text-xs border-primary/30 hover:border-primary/60">
                    <ScanLine className="w-3.5 h-3.5 mr-1" />{ocrLoading ? "Detecting..." : "Auto-detect"}
                  </Button>
                )}
                <Button onClick={handleAddField} disabled={activeFieldType === "signature" && !signature} size="sm" className="bg-primary/90">
                  {activeFieldType === "signature" ? <Signature className="w-3.5 h-3.5 mr-1" /> : activeFieldType === "checkbox" ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : activeFieldType === "date" ? <Calendar className="w-3.5 h-3.5 mr-1" /> : <Type className="w-3.5 h-3.5 mr-1" />}
                  Add
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Type:</span>
              {FIELD_TYPES.map(({ type, label }) => (
                <button key={type} onClick={() => setActiveFieldType(type)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${activeFieldType === type ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"}`}>
                  {label}
                </button>
              ))}
              {(activeFieldType === "typed" || activeFieldType === "initials") && (
                <input type="text" value={typedFieldText} onChange={(e) => setTypedFieldText(e.target.value)}
                  placeholder={activeFieldType === "typed" ? "Full name..." : "Initials..."}
                  className="px-2 py-1 rounded-md text-xs border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-24" />
              )}
              {/* Phase 2 P2.4 — range workflow toggle. When active, the next
                  page click sets the draft start anchor instead of
                  creating a placement; navigation extends the end page;
                  Seal commits one range as one undo step. */}
              <button
                onClick={() => sigPlacement.toggleRangeMode()}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  sigPlacement.rangeMode
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
                title="Toggle range placement mode (one record stamps across multiple pages)"
              >
                <Repeat className="w-3 h-3" />Range
              </button>
              {sigPlacement.rangeDraft && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => {
                      sigPlacement.commitRangeDraft();
                      hapticSuccess();
                      toast.success("Range sealed across pages.");
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
                    title={`Seal range on page ${sigPlacement.rangeDraft.endPage}`}
                  >
                    Seal Range
                  </button>
                  <button
                    onClick={() => {
                      sigPlacement.cancelRangeDraft();
                      hapticLight();
                      toast.info("Range draft canceled.");
                    }}
                    className="p-1 rounded-md bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
                    title="Cancel range draft (or press Esc)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground ml-1 px-1.5 py-0.5 rounded bg-secondary/30">
                    PG {sigPlacement.rangeDraft.startPage} → {sigPlacement.rangeDraft.endPage}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
        {/* Word docs: simplified toolbar */}
        {isDocx && (
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Word Document</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">Type:</span>
                {FIELD_TYPES.map(({ type, label }) => (
                  <button key={type} onClick={() => setActiveFieldType(type)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${activeFieldType === type ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"}`}>
                    {label}
                  </button>
                ))}
                {(activeFieldType === "typed" || activeFieldType === "initials") && (
                  <input type="text" value={typedFieldText} onChange={(e) => setTypedFieldText(e.target.value)}
                    placeholder={activeFieldType === "typed" ? "Full name..." : "Initials..."}
                    className="px-2 py-1 rounded-md text-xs border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-24" />
                )}
              </div>
              <Button onClick={handleAddField} disabled={activeFieldType === "signature" && !signature} size="sm" className="bg-primary/90">
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Templates */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {sigPlacement.signatures.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleSaveTemplate} className="text-xs text-primary hover:bg-primary/10">
              <Bookmark className="w-3 h-3 mr-1" />Save as Template
            </Button>
          )}
          {templates.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Templates:</span>
              {templates.slice(0, 4).map(tpl => (
                <div key={tpl.id} className="flex items-center gap-0.5">
                  <button onClick={() => handleLoadTemplate(tpl)} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-xs text-primary hover:bg-primary/20 transition-colors whitespace-nowrap">
                    <BookmarkCheck className="w-3 h-3" />{tpl.name}
                  </button>
                  <button onClick={() => handleDeleteTemplate(tpl.id, tpl.name)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <span className="text-[10px]">×</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phase 2 P2.1 — post-download signing receipt.
            Rendered once per successful download so the hash, signers,
            timestamp, and copy/download actions stay available even after
            the success toast fades. */}
        <SignedSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          summary={summary}
        />

        {/* Saved signature picker */}
        {savedSignatures && savedSignatures.length > 1 && (
          <SignaturePicker savedSignatures={savedSignatures} activeSignature={signature} onSelect={onSignatureChange} />
        )}

        {/* Phase 7 — export success paper-dust burst. Overlays the document
            area when a download/share completes. Auto-resets after the
            animation so it can re-trigger on the next download. */}
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <SuccessBurst
            active={successBurstActive}
            onComplete={() => setSuccessBurstActive(false)}
          />
        </div>

        {/* Docx content: div with dangerouslySetInnerHTML (no cross-origin issues) */}
        {isDocx && docxLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            <FileText className="w-5 h-5 mr-2 animate-pulse" />
            Converting Word document...
          </div>
        ) : isDocx && docxHtml ? (
          <div
            ref={containerRef}
            className="relative bg-accent/20 rounded-xl overflow-hidden border border-border/50"
            onPointerDown={(e) => { if (containerRef.current) sigPlacement.handlePointerDown(e, containerRef.current); }}
            onPointerMove={(e) => { if (containerRef.current) sigPlacement.handlePointerMove(e, containerRef.current); }}
            onPointerUp={sigPlacement.handlePointerUp}
          >
            <div
              ref={docxContentRef}
              data-docx-content="true"
              className="bg-white text-foreground p-10"
              style={{
                fontFamily: "'Segoe UI', Calibri, Arial, sans-serif",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#1a1a1a",
                minHeight: "600px",
              }}
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
            <SignaturePlacementLayer
              signatures={sigPlacement.signatures} detectedFields={[]}
              currentPage={1} isImage={false} signature={signature}
              onFieldClick={() => {}}
              onSignaturePointerDown={(e, sigId) => { if (containerRef.current) sigPlacement.handlePointerDown(e, containerRef.current, sigId); }}
              onPointerMove={(e) => { if (containerRef.current) sigPlacement.handlePointerMove(e, containerRef.current); }}
              onPointerUp={sigPlacement.handlePointerUp}
              onResizeStart={sigPlacement.handleResizeStart}
              onRemoveSignature={sigPlacement.removeSignature}
              onTouchStart={sigPlacement.handleTouchStart}
              onTouchMove={sigPlacement.handleTouchMove}
              onTouchEnd={sigPlacement.handleTouchEnd}
              onToggleCheckbox={sigPlacement.toggleCheckbox}
              participants={multiPartyParticipants}
              currentRecipientId={currentRecipientId}
            />
          </div>
        ) : (
          /*
           * Phase 2 P2.3 — split-canvas dispatch:
           *   isTabletLayout (>=1024px wide):
           *     - PDF / image canvas occupies the LEFT column at the new
           *       wider 1100px DESKTOP_CAP.
           *     - TabletSidebarPanel sits on the RIGHT with signers list,
           *       role legend, and (for multi-page) page thumbnails.
           *   !isTabletLayout (mobile / small tablet <1024px):
           *     - Single-column with the page column in the middle.
           *     - For multi-page PDFs in the 768-1023 small-tablet range,
           *       we render PageThumbnailSidebar to the LEFT of the page
           *       column (legacy P2.2 layout) — the sidebar's own `hidden
           *       md:flex` root class keeps it hidden below 768px.
           */
          (() => {
            const pdfRenderer = (
              <DocumentRenderer
                fileUrl={fileUrl}
                isImage={isImage}
                currentPage={currentPage}
                numPages={numPages}
                pageWidth={pageWidth}
                containerRef={containerRef}
                signatures={sigPlacement.signatures}
                onDocumentLoadSuccess={onDocumentLoadSuccess}
                onPageChange={setCurrentPage}
                onPointerDown={handleContainerPointerDown}
                onPointerMove={(e) => {
                  if (containerRef.current) sigPlacement.handlePointerMove(e, containerRef.current);
                }}
                onPointerUp={sigPlacement.handlePointerUp}
              >
                <SignaturePlacementLayer
                  signatures={sigPlacement.signatures}
                  detectedFields={detectedFields}
                  currentPage={currentPage}
                  isImage={isImage}
                  signature={signature}
                  onFieldClick={handleFieldClick}
                  onSignaturePointerDown={(e, sigId) => {
                    if (containerRef.current)
                      sigPlacement.handlePointerDown(e, containerRef.current, sigId);
                  }}
                  onPointerMove={(e) => {
                    if (containerRef.current) sigPlacement.handlePointerMove(e, containerRef.current);
                  }}
                  onPointerUp={sigPlacement.handlePointerUp}
                  onResizeStart={sigPlacement.handleResizeStart}
                  onRemoveSignature={sigPlacement.removeSignature}
                  onTouchStart={sigPlacement.handleTouchStart}
                  onTouchMove={sigPlacement.handleTouchMove}
                  onTouchEnd={sigPlacement.handleTouchEnd}
                  onToggleCheckbox={sigPlacement.toggleCheckbox}
                  participants={multiPartyParticipants}
                  currentRecipientId={currentRecipientId}
                  displayWidth={pageWidth}
                  displayHeight={displayHeight}
                  rangeDraft={sigPlacement.rangeDraft}
                />
              </DocumentRenderer>
            );

            if (isTabletLayout) {
              // Split-canvas: PDF left, right panel (signers + legend +
              // thumbnails) on the right. The right panel self-hides when
              // there's nothing to show (no signers + single-page PDF).
              return (
                <div className="flex gap-4 items-start w-full">
                  <div className="flex-1 min-w-0">{pdfRenderer}</div>
                  <TabletSidebarPanel
                    fileUrl={fileUrl}
                    numPages={numPages}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    signatures={sigPlacement.signatures}
                    participants={multiPartyParticipants ?? []}
                    currentRecipientId={currentRecipientId}
                  />
                </div>
              );
            }

            // Small tablet (>= 768) and below: PDF only. If multi-page,
            // wrap with a flex row so PageThumbnailSidebar slots in on the
            // LEFT (legacy P2.2 layout, retained for the 768-1023 range).
            if (!isImage && numPages > 1) {
              return (
                <div className="md:flex md:gap-2 md:items-start relative">
                  <PageThumbnailSidebar
                    fileUrl={fileUrl}
                    numPages={numPages}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    signatures={sigPlacement.signatures}
                  />
                  <div className="flex-1 min-w-0">{pdfRenderer}</div>
                </div>
              );
            }

            return pdfRenderer;
          })()
        )}
      </Card>
      </DocumentFoldIn>
    </motion.div>
  );
};

function SignaturePicker({ savedSignatures, activeSignature, onSelect }: { savedSignatures: SavedSignature[]; activeSignature?: string; onSelect?: (sig: string) => void }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 overflow-x-auto">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Active:</span>
      {savedSignatures.map((saved) => (
        <button key={saved.id} onClick={() => onSelect?.(saved.dataUrl)}
          className={`relative flex-shrink-0 w-20 h-10 rounded-lg border-2 transition-all p-0.5 flex items-center justify-center ${activeSignature === saved.dataUrl ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:border-primary/50 bg-card/50"}`}>
          <img src={saved.dataUrl} alt={saved.label} className="max-w-full max-h-full object-contain" draggable={false} />
          {activeSignature === saved.dataUrl && (
            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-glow">
              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
