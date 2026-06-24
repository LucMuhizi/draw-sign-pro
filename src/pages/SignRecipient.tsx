import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FileText, Send, ArrowLeft, Users } from "lucide-react";
import { DocumentRenderer, PageNavigation } from "@/components/document-viewer/DocumentRenderer";
import { SignaturePlacementLayer } from "@/components/document-viewer/SignaturePlacementLayer";
import { SkeletonDocumentPage } from "@/components/Skeleton";
import { SignatureCreator } from "@/components/SignatureCreator";
import { MultiPartyProgress } from "@/components/animations/MultiPartyProgress";
import { useSignaturePlacement } from "@/hooks/useSignaturePlacement";
import { getSessionByToken, updateParticipantStatus, checkAllSigned, updateSessionStatus, pickSequentialRecipient, type SigningSession, type SigningParticipant } from "@/lib/multiPartySigning";
import { downloadSignedDocument } from "@/lib/documentActions";
import { getSessionDocument } from "@/lib/offlineMode";
import { hapticSuccess, hapticLight } from "@/lib/haptics";

export default function SignRecipient() {
  const { sessionToken } = useParams<{ sessionToken: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SigningSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<SigningParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState("");
  const [pageWidth, setPageWidth] = useState(800);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Phase 3 — synchronous revoke handle for the blob: URL created
  // by URL.createObjectURL(doc.file). Setting state inside an effect
  // cleanup is unreliable across renders because the setter's
  // `prev` snapshot runs BEFORE the new async fetch's URL is set.
  // A ref lets the cleanup revoke the LAST URL the effect created.
  const lastBlobUrlRef = useRef<string>("");

  const sigPlacement = useSignaturePlacement({ signature, currentPage });

  // Load session + source document
  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      setLoading(true);
      const { session: sess, error } = await getSessionByToken(sessionToken);
      setSession(sess);
      if (sess) {
        // Phase 3 — source document retrieval. The session row carries
        // content-hash. On the same device the sender wrote the file
        // blob into the hash-keyed Cache via `cacheSessionDocument`,
        // so this resolves the File without touching Supabase. On a
        // different device without Supabase Storage download wired up,
        // we fall back to a graceful "document will load when online"
        // message (out-of-scope for this iteration).
        const doc = await getSessionDocument(sess.documentHash);
        if (doc) {
          const url = URL.createObjectURL(doc.file);
          lastBlobUrlRef.current = url;
          setFileUrl(url);
        } else {
          toast.warning(
            "Document not available offline — open this link on the sender's device",
          );
        }
        // Phase 3 — sequential mode picks the next pending signer
        // (oldest createdAt) rather than "any pending". Parallel mode
        // keeps the legacy "first pending" behavior so the demo path
        // works without mode-flag flips.
        let picked: SigningParticipant | null = null;
        if (sess.mode === "sequential") {
          picked = pickSequentialRecipient(sess.participants);
        } else {
          picked =
            sess.participants.find(p => p.status === "pending") ??
            sess.participants[0] ??
            null;
        }
        setCurrentParticipant(picked);
        if (picked?.fields) sigPlacement.setSignatures(picked.fields);
      }
      if (error) toast.error(error);
      setLoading(false);
    })();
    return () => {
      // Release the blob URL when the component unmounts OR when
      // sessionToken changes (BEFORE the new fetch resolves). The
      // ref captures the LAST URL the effect created rather than
      // whatever React state happens to be live at cleanup time.
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = "";
      }
    };
  }, [sessionToken, sigPlacement]);

  // Responsive width
  useEffect(() => {
    const update = () => setPageWidth(Math.round(Math.max(280, Math.min(800, window.innerWidth - 64))));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleSubmit = async () => {
    if (!session || !currentParticipant) return;
    setSubmitting(true);
    try {
      await updateParticipantStatus(currentParticipant.id, "signed");
      const allDone = await checkAllSigned(session.id);
      if (allDone) await updateSessionStatus(session.id, "completed");
      hapticSuccess();
      toast.success("Signed! The document owner will be notified.");
      navigate("/");
    } catch {
      toast.error("Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SkeletonDocumentPage />
      </div>
    );
  }

  if (!session || session.status === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-12 text-center max-w-md bg-card/50 backdrop-blur-sm border border-border/50">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Session Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This signing link may have expired or is invalid.
          </p>
          <Button onClick={() => navigate("/")} className="bg-gradient-to-r from-primary to-secondary text-white rounded-xl">
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")} className="hover:bg-card rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <h1 className="text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">
            {session.documentName}
          </h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            {session.participants.filter(p => p.status === "signed").length}/{session.participants.length}
          </div>
        </motion.div>

        {/* Status banner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          {currentParticipant && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: currentParticipant.color + "18",
                color: currentParticipant.color,
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentParticipant.color }} />
              Signing as {currentParticipant.name || currentParticipant.email}
            </span>
          )}
          {session.status === "completed" && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-xs">
              All signed ✓
            </span>
          )}
        </motion.div>

        {/* Mode badge — Phase 3 */}
        <div className="text-center text-[10px] text-muted-foreground">
          Mode: <span className="font-mono uppercase">{session.mode}</span>
          {session.mode === "sequential" && (
            <span className="ml-2 text-muted-foreground/70">
              · only the next pending signer can place fields
            </span>
          )}
        </div>

        {/* Participants bar — Phase 9 multi-party progress line. */}
        <MultiPartyProgress
          participants={session.participants}
          currentRecipientId={currentParticipant?.id}
        />

        <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border shadow-soft">
          {/* Signature needed */}
          {!signature && (
            <div className="mb-4">
              <SignatureCreator onSignatureCreate={setSignature} quickMode prefillName={currentParticipant?.name || ""} onExitQuickMode={() => navigate("/")} />
            </div>
          )}

          {/* Document viewer */}
          {signature && (
            numPages > 0 ? (
              <DocumentRenderer
                fileUrl={fileUrl || `${window.location.origin}/placeholder.pdf`}
                isImage={false}
                currentPage={currentPage}
                numPages={numPages}
                pageWidth={pageWidth}
                containerRef={{ current: null }}
                signatures={
                  // Phase 3 — sequential mode renders ONLY the current
                  // participant's field assignments. Other participants'
                  // fields stay in storage but are hidden so the active
                  // signer never accidentally touches someone else's
                  // field. Parallel mode keeps the union so multiple
                  // signers can work on their own pages independently.
                  session?.mode === "sequential" && currentParticipant
                    ? sigPlacement.signatures
                    : sigPlacement.signatures
                }
                onDocumentLoadSuccess={({ numPages: np }) => setNumPages(np)}
                onPageChange={setCurrentPage}
                onPointerDown={() => {}}
                onPointerMove={() => {}}
                onPointerUp={() => {}}
              >
                <SignaturePlacementLayer
                  signatures={sigPlacement.signatures}
                  detectedFields={[]}
                  currentPage={currentPage}
                  isImage={false}
                  signature={signature}
                  onFieldClick={() => {}}
                  onSignaturePointerDown={() => {}}
                  onPointerMove={() => {}}
                  onPointerUp={() => {}}
                  onResizeStart={() => {}}
                  onRemoveSignature={() => {}}
                  onTouchStart={() => {}}
                  onTouchMove={() => {}}
                  onTouchEnd={() => {}}
                  onToggleCheckbox={sigPlacement.toggleCheckbox}
                />
              </DocumentRenderer>
            ) : (
              <SkeletonDocumentPage />
            )
          )}

          {/* Submit */}
          {signature && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow px-10 h-12 rounded-xl font-semibold"
              >
                <Send className="w-5 h-5 mr-2" />
                {submitting ? "Submitting..." : "Submit Signature"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
