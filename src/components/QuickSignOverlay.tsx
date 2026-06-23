import { useState, useEffect } from "react";
import { Zap, PenLine, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getProfile, type UserProfile } from "@/lib/userProfile";
import { hapticLight } from "@/lib/haptics";
import { renderTypedSignature } from "@/lib/utils";

interface QuickSignOverlayProps {
  fileName: string;
  onSignNow: (signatureDataUrl: string) => void;
  onChangeSignature: () => void;
  onDismiss: () => void;
}

const FONT_LABELS: Record<string, string> = {
  cursive: "Script",
  serif: "Serif",
  "sans-serif": "Sans",
  monospace: "Mono",
};

export const QuickSignOverlay = ({
  fileName,
  onSignNow,
  onChangeSignature,
  onDismiss,
}: QuickSignOverlayProps) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sigPreview, setSigPreview] = useState("");

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      if (p.displayName) {
        setSigPreview(renderTypedSignature(p.displayName, p.preferredFont, 48, p.preferredSigColor));
      }
    });
  }, []);

  const handleSignNow = () => {
    if (!profile?.displayName || !sigPreview) {
      toast.error("Please set up your signature first");
      onChangeSignature();
      return;
    }
    hapticLight();
    onSignNow(sigPreview);
  };

  if (!profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-x-0 bottom-0 z-50"
      >
        <Card className="rounded-t-3xl p-6 bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full"
        >
          <Card className="rounded-t-3xl p-6 bg-card/95 backdrop-blur-xl border-t border-border shadow-2xl space-y-5">
            {/* Drag handle */}
            <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full" />

            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
                <Zap className="w-3.5 h-3.5" />
                Quick Sign
              </div>
              <h2 className="text-lg font-semibold text-foreground">Ready to sign?</h2>
            </div>

            {/* Document info */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border/50">
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground truncate">{fileName}</span>
            </div>

            {/* Signature preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <PenLine className="w-3.5 h-3.5" />
                  Your signature
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {FONT_LABELS[profile.preferredFont] || profile.preferredFont} • Auto-placed
                </span>
              </div>
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-background/50 p-4 flex items-center justify-center min-h-[72px]">
                {sigPreview ? (
                  <img src={sigPreview} alt="Signature preview" className="max-w-full max-h-16 object-contain" />
                ) : (
                  <span className="text-sm text-muted-foreground">Set up your signature in profile</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleSignNow}
                disabled={!sigPreview}
                className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all h-12 rounded-xl font-semibold text-base"
              >
                <motion.span className="flex items-center gap-2" whileHover={{ x: 4 }}>
                  Sign & Place
                  <ArrowRight className="w-4 h-4" />
                </motion.span>
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onChangeSignature}
                  className="flex-1 rounded-xl"
                >
                  Change
                </Button>
                <Button
                  variant="ghost"
                  onClick={onDismiss}
                  className="flex-1 rounded-xl"
                >
                  Manual Mode
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
