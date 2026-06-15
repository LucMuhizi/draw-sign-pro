import { useState, useEffect } from "react";
import { ActionBar } from "@/components/ActionBar";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SignatureCreator } from "@/components/SignatureCreator";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Button } from "@/components/ui/button";
import { useSignatures, syncLocalToCloud, fetchCloudSignatures } from "@/lib/signatureStorage";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Wifi, WifiOff, Fingerprint } from "lucide-react";
import { cacheDocument, isOnline, onOnlineChange, getCacheInfo } from "@/lib/offlineMode";
import { isLockEnabled, checkBiometricLock } from "@/lib/biometricLock";

const pageVariants = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 1.03, filter: "blur(6px)" },
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

  const handleActionClick = (action: string) => {
    setActiveAction(action);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    cacheDocument(file);
  };

  const handleSignatureCreate = (sig: string) => {
    setSignature(sig);
  };

  const handleSignatureChange = (sig: string) => {
    setSignature(sig);
  };

  return (
    <div className="min-h-screen bg-background pb-24 relative z-10">
      <ActionBar activeAction={activeAction} onActionClick={handleActionClick} />

      <main className="pt-4 pb-8 px-4">
        <div className="max-w-2xl mx-auto relative z-20">
          <div className="flex items-center justify-center gap-2 mb-4">
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
          </div>
          <AnimatePresence mode="wait">
            {activeAction === "upload" && (
              <motion.div
                key="upload"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <DocumentUpload onFileSelect={handleFileSelect} />
                {selectedFile && (
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
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <SignatureCreator onSignatureCreate={handleSignatureCreate} />
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
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                {selectedFile && signature ? (
                  <>
                    <DocumentViewer
                      file={selectedFile}
                      signature={signature}
                      onBack={() => setActiveAction("upload")}
                      onSignaturePlaced={(count) => setPlacedSignaturesCount(count)}
                      savedSignatures={savedSignatures}
                      onSignatureChange={handleSignatureChange}
                    />
                    {placedSignaturesCount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 25 }}
                        className="flex justify-center mt-8"
                      >
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
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
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
    </div>
  );
};

export default Index;
