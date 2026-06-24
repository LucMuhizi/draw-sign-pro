import { useState, useEffect, useCallback } from "react";
import { ActionBar } from "@/components/ActionBar";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SignatureCreator } from "@/components/SignatureCreator";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Button } from "@/components/ui/button";
import { QuickSignOverlay } from "@/components/QuickSignOverlay";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { useSignatures, syncLocalToCloud, fetchCloudSignatures } from "@/lib/signatureStorage";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Wifi, WifiOff, Fingerprint, RefreshCw, Users } from "lucide-react";
import { cacheDocument, cacheSessionDocument, getCacheInfo, isOnline, onOnlineChange } from "@/lib/offlineMode";
import { isLockEnabled, checkBiometricLock } from "@/lib/biometricLock";
import { hapticLight } from "@/lib/haptics";
import { getQueueLength, startBackgroundSync, stopBackgroundSync } from "@/lib/syncQueue";
import { getProfile, isQuickSignEnabled } from "@/lib/userProfile";
import { getItem, setItem } from "@/lib/storage";
import { RecipientManager } from "@/components/RecipientManager";
import { hashDocument } from "@/lib/auditTrail";
import { createSigningSession, addParticipant, getShareUrl, type SessionMode, type SigningParticipant } from "@/lib/multiPartySigning";
import { track } from "@/lib/telemetry";

const STEPS = ["upload", "signature", "add-signature", "download"] as const;
type Step = typeof STEPS[number];

const pageVariants = {
  initial: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 200 : -200,
    scale: 0.96,
  }),
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -200 : 200,
    scale: 0.96,
  }),
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const Index = () => {
  const [activeAction, setActiveAction] = useState<string>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<string>("");
  const [placedSignaturesCount, setPlacedSignaturesCount] = useState<number>(0);
  const { signatures: savedSignatures, replaceAll } = useSignatures();
  const { user } = useAuth();
  const [online, setOnline] = useState(isOnline());
  const [bioChecked, setBioChecked] = useState(false);
  const [bioPassed, setBioPassed] = useState(false);
  const [navDir, setNavDir] = useState(0);
  const [pendingSync, setPendingSync] = useState(getQueueLength());
  const [quickSignOn, setQuickSignOn] = useState(false);
  const [showQuickSignOverlay, setShowQuickSignOverlay] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [multiPartyMode, setMultiPartyMode] = useState(false);
  const [multiPartyModeStrategy, setMultiPartyModeStrategy] = useState<SessionMode>("parallel");
  const [showRecipientManager, setShowRecipientManager] = useState(false);
  const [participants, setParticipants] = useState<SigningParticipant[]>([]);
  const [currentRecipientId, setCurrentRecipientId] = useState<string | undefined>();
  const [shareUrl, setShareUrl] = useState("");
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setPendingSync(getQueueLength()), 5000);
    startBackgroundSync(async () => true);
    return () => { clearInterval(interval); stopBackgroundSync(); };
  }, []);

  useEffect(() => {
    if (isLockEnabled() && !bioChecked) {
      setBioChecked(true);
      checkBiometricLock().then(passed => {
        setBioPassed(passed);
        if (!passed) toast.error("Biometric verification required");
      });
    } else if (!bioChecked) {
      setBioChecked(true);
      setBioPassed(true);
    }
  }, [bioChecked]);

  useEffect(() => {
    return onOnlineChange(setOnline);
  }, []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const cloud = await fetchCloudSignatures(user.id);
      if (cloud.length > 0) {
        replaceAll(cloud);
        toast.success(`Synced ${cloud.length} signature(s) from cloud`);
      } else {
        await syncLocalToCloud(user.id);
      }
    })();
  }, [user, replaceAll]);

  // First-time privacy toast
  useEffect(() => {
    getItem<{ seen: boolean }>("draw-sign-pro-privacy-seen").then(data => {
      if (!data?.seen) {
        toast("🔒 Your documents stay on your device — no cloud required", {
          description: "Sign anywhere, even offline. Cloud sync is optional.",
          duration: 6000,
        });
        setItem("draw-sign-pro-privacy-seen", { seen: true });
      }
    });
  }, []);

  const handleActionClick = (action: string) => {
    setActiveAction(action);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    cacheDocument(file);
    track("funnel_upload_started", {
      fileType: file.type || "unknown",
      fileSize: file.size,
      name: file.name,
    });
    if (quickSignOn && profileName) {
      setShowQuickSignOverlay(true);
    }
  };

  const handleSignatureCreate = (sig: string) => {
    setSignature(sig);
    track("funnel_signature_created", {
      // We don't track the signature image — only that one was created.
      length: sig.length,
    });
  };

  const handleSignatureChange = (sig: string) => {
    setSignature(sig);
  };

  // Multi-party: init session when entering add-signature with multiPartyMode
  useEffect(() => {
    if (multiPartyMode && selectedFile && activeAction === "add-signature" && !sessionId) {
      hashDocument(selectedFile).then(async (hash) => {
        // Phase 3 — drop the source document into the local hash-keyed
        // session-doc cache BEFORE creating the session so the recipient
        // page (on the same device) can find it on mount without going
        // through Supabase Storage. Falls back silently on private
        // browsing where `caches` is unavailable.
        await cacheSessionDocument(selectedFile, hash);
        const { session, error } = await createSigningSession(
          selectedFile.name,
          hash,
          multiPartyModeStrategy,
        );
        if (session) {
          setSessionId(session.id);
          setShareUrl(getShareUrl(session.shareToken));
          const senderName = profileName || user?.email?.split("@")[0] || "Me";
          const { participant } = await addParticipant(session.id, user?.email || "", senderName, "sender");
          if (participant) {
            setParticipants([participant]);
            setCurrentRecipientId(participant.id);
          }
        }
        if (error) toast.warning(error);
      });
    }
  }, [multiPartyMode, multiPartyModeStrategy, selectedFile, activeAction, sessionId]);
  const handleQuickSignNow = useCallback((sigDataUrl: string) => {
    setSignature(sigDataUrl);
    setShowQuickSignOverlay(false);
    hapticLight();
    setNavDir(1);
    setActiveAction("add-signature");
  }, []);

  const handleQuickSignChange = useCallback(() => {
    setShowQuickSignOverlay(false);
    setNavDir(1);
    setActiveAction("signature");
  }, []);

  const handleQuickSignDismiss = useCallback(() => {
    setShowQuickSignOverlay(false);
  }, []);

  const handleQuickSignToggle = useCallback((enabled: boolean) => {
    setQuickSignOn(enabled);
    if (enabled) {
      getProfile().then(p => setProfileName(p.displayName));
    }
  }, []);

  // Multi-party: add/remove/select recipients
  const handleAddRecipient = useCallback((email: string, name: string) => {
    if (!sessionId) return;
    addParticipant(sessionId, email, name).then(({ participant }) => {
      if (participant) setParticipants(prev => [...prev, participant]);
    });
  }, [sessionId]);

  const handleRemoveRecipient = useCallback((id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    hapticLight();
  }, []);

  const handleSelectRecipient = useCallback((id: string | undefined) => {
    setCurrentRecipientId(id);
    setPlacedSignaturesCount(0);
  }, []);

  const currentStepIndex = STEPS.indexOf(activeAction as Step);

  const handleSwipe = useCallback((offset: number, velocity: number) => {
    const threshold = 60;
    const velocityThreshold = 0.5;
    const isLeftSwipe = (offset < -threshold || velocity < -velocityThreshold) && currentStepIndex < STEPS.length - 1;
    const isRightSwipe = (offset > threshold || velocity > velocityThreshold) && currentStepIndex > 0;

    if (isLeftSwipe) {
      const next = STEPS[currentStepIndex + 1];
      const canProceed = (
        (next === 'signature' && selectedFile && !quickSignOn) ||
        (next === 'add-signature' && selectedFile && signature) ||
        (next === 'download' && placedSignaturesCount > 0)
      );
      if (!canProceed) return;
      hapticLight();
      setNavDir(1);
      setActiveAction(next);
    } else if (isRightSwipe) {
      hapticLight();
      setNavDir(-1);
      setActiveAction(STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex, selectedFile, signature, placedSignaturesCount]);

  return (
    <div className="min-h-screen bg-background pb-24 relative z-10">
      <ActionBar activeAction={activeAction} onActionClick={handleActionClick} onQuickSignToggle={handleQuickSignToggle} />

      <main className="pt-4 pb-8 px-4">
        <div className="max-w-2xl mx-auto relative z-20">
          <div className="flex items-center justify-center gap-2 mb-4">
            {multiPartyMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                <Users className="w-3 h-3" />
                Multi-Party
              </span>
            )}
            {!online && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-medium">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            )}
            {isLockEnabled() && !bioPassed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-medium">
                <Fingerprint className="w-3 h-3" />
                Locked
              </span>
            )}
            {pendingSync > 0 && online && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Syncing {pendingSync}
              </span>
            )}
          </div>
          {/* Phase 1 P1.1 — disclaimer banner lives outside AnimatePresence
              so its dismiss state survives tab switches. Users dismiss once and
              never see it again. */}
          <DisclaimerBanner />

          <AnimatePresence mode="wait" custom={navDir}>
            {activeAction === "upload" && (
              <motion.div
                key="upload"
                custom={navDir}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => handleSwipe(info.offset.x, info.velocity.x)}
              >
                <DocumentUpload onFileSelect={handleFileSelect} />
                {selectedFile && !quickSignOn && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 25 }}
                    className="flex flex-col items-center gap-2 mt-8"
                  >
                    <div className="flex gap-2">
                    <Button
                      onClick={() => { setMultiPartyMode(false); setActiveAction('signature'); }}
                      size="lg"
                      className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all pointer-events-auto z-30 px-8 h-12 text-base font-semibold rounded-xl"
                    >
                      <motion.span className="flex items-center" whileHover={{ x: 4 }}>
                        Continue to Signature
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </motion.span>
                    </Button>
                    <Button
                      onClick={() => {
                        // Phase 3 — cycle through parallel → sequential →
                        // parallel so the same entry point doubles as a
                        // mode picker. Subtle: a future polish iter is
                        // to make this a 2-state segmented control inside
                        // the recipient manager sheet instead.
                        setMultiPartyModeStrategy(prev =>
                          prev === 'parallel' ? 'sequential' : 'parallel',
                        );
                        setMultiPartyMode(true);
                        setActiveAction('add-signature');
                      }}
                      variant="outline"
                      size="lg"
                      className="border-primary/40 hover:border-primary text-primary hover:bg-primary/5 px-8 h-12 text-base font-semibold rounded-xl"
                    >
                      <Users className="w-5 h-5 mr-2" />
                      Multi-Party
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/15 text-[10px] font-mono uppercase tracking-wide">
                        {multiPartyModeStrategy}
                      </span>
                    </Button>
                    </div>
                  </motion.div>
                )}
                {selectedFile && quickSignOn && profileName && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 25 }}
                    className="flex justify-center mt-8"
                  >
                    <Button
                      onClick={() => setActiveAction('signature')}
                      size="lg"
                      className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all pointer-events-auto z-30 px-8 h-12 text-base font-semibold rounded-xl"
                    >
                      <motion.span
                        className="flex items-center"
                        whileHover={{ x: 4 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        Continue to Signature
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </motion.span>
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeAction === "signature" && (
              <motion.div
                key="signature"
                custom={navDir}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => handleSwipe(info.offset.x, info.velocity.x)}
              >
                <SignatureCreator onSignatureCreate={handleSignatureCreate} quickMode={showQuickSignOverlay || quickSignOn} prefillName={profileName} onExitQuickMode={() => { setActiveAction("upload"); }} />
                {signature && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 25 }}
                    className="flex justify-center mt-8"
                  >
                    <Button
                      onClick={() => setActiveAction('add-signature')}
                      size="lg"
                      className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all pointer-events-auto z-30 px-8 h-12 text-base font-semibold rounded-xl"
                    >
                      <motion.span
                        className="flex items-center"
                        whileHover={{ x: 4 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        Place Signature
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </motion.span>
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeAction === "add-signature" && (
              <motion.div
                key="add-signature"
                custom={navDir}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => handleSwipe(info.offset.x, info.velocity.x)}
              >
                {selectedFile && signature ? (
                  <>
                    <DocumentViewer
                      file={selectedFile}
                      signature={signature}
                      onBack={() => { setActiveAction("upload"); setMultiPartyMode(false); setSessionId(""); setParticipants([]); setCurrentRecipientId(undefined); setShareUrl(""); }}
                      onSignaturePlaced={(count) => setPlacedSignaturesCount(count)}
                      savedSignatures={savedSignatures}
                      onSignatureChange={handleSignatureChange}
                      multiPartyParticipants={participants}
                      currentRecipientId={currentRecipientId}
                    />
                    {/* Multi-party: recipient selector + manager */}
                    {multiPartyMode && participants.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
                        className="mt-4 space-y-3"
                      >
                        {/* Current recipient selector */}
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          <span className="text-xs text-muted-foreground">Placing for:</span>
                          {participants.map(p => (
                            <button
                              key={p.id}
                              onClick={() => handleSelectRecipient(p.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                currentRecipientId === p.id
                                  ? "shadow-glow"
                                  : "opacity-60 hover:opacity-100"
                              }`}
                              style={{
                                backgroundColor: (currentRecipientId === p.id ? p.color + "20" : p.color + "08"),
                                borderColor: currentRecipientId === p.id ? p.color + "60" : p.color + "25",
                                color: p.color,
                              }}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name || p.email.split("@")[0]}

                            </button>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRecipientManager(true)}
                            className="text-xs rounded-full"
                          >
                            <Users className="w-3.5 h-3.5 mr-1" />
                            Manage
                          </Button>
                        </div>

                        {/* Download button */}
                        <div className="flex justify-center">
                          <Button
                            onClick={() => setActiveAction('download')}
                            size="lg"
                            className="bg-gradient-to-r from-accent to-warning text-white shadow-accent hover:shadow-glow transition-all pointer-events-auto z-30 px-8 h-12 text-base font-semibold rounded-xl"
                          >
                            <motion.span
                              className="flex items-center"
                              whileHover={{ x: 4 }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                            >
                              Download Signed Document
                              <ArrowRight className="w-5 h-5 ml-2" />
                            </motion.span>
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <h1 className="text-2xl font-bold text-foreground mb-2">Place Signature</h1>
                    <p className="text-muted-foreground">Please upload a document and create a signature first</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeAction === "download" && (
              <motion.div
                key="download"
                custom={navDir}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => handleSwipe(info.offset.x, info.velocity.x)}
              >
                {selectedFile && signature ? (
                  <DocumentViewer
                    file={selectedFile}
                    signature={signature}
                    onBack={() => setActiveAction("upload")}
                    savedSignatures={savedSignatures}
                    onSignatureChange={handleSignatureChange}
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <h1 className="text-2xl font-bold text-foreground mb-2">Download</h1>
                    <p className="text-muted-foreground">Please upload a document and create a signature first</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Quick Sign overlay */}
      <AnimatePresence>
        {showQuickSignOverlay && selectedFile && (
          <QuickSignOverlay
            fileName={selectedFile.name}
            onSignNow={handleQuickSignNow}
            onChangeSignature={handleQuickSignChange}
            onDismiss={handleQuickSignDismiss}
          />
        )}
      </AnimatePresence>

      {/* Recipient Manager bottom sheet */}
      <RecipientManager
        open={showRecipientManager}
        onOpenChange={setShowRecipientManager}
        participants={participants}
        onAddParticipant={handleAddRecipient}
        onRemoveParticipant={handleRemoveRecipient}
        shareUrl={shareUrl}
        onShare={() => {
          import("@/lib/share").then(({ shareText }) => shareText(shareUrl, `Sign ${selectedFile?.name || "document"}`));
        }}
      />
    </div>
  );
};

export default Index;
