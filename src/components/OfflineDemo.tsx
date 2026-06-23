import { useState } from "react";
import { Wifi, WifiOff, Shield, FileCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/BottomSheet";
import { motion, AnimatePresence } from "framer-motion";
import { isInstalled, triggerInstall, getInstallPlatform } from "@/lib/pwaInstall";
import { toast } from "sonner";

interface OfflineDemoProps {
  open: boolean;
  onDismiss: () => void;
}

const steps = [
  {
    icon: Shield,
    title: "Your Documents, Your Device",
    description: "All processing happens locally — PDFs, signatures, and personal data never leave your device unless you choose to sync.",
  },
  {
    icon: WifiOff,
    title: "Works Without Internet",
    description: "Sign documents on a plane, in a basement, or anywhere. We store your docs locally and sync when you're back online.",
  },
  {
    icon: FileCheck,
    title: "Sign & Download — Anytime",
    description: "Upload a document, create your signature, place it, and download the signed PDF — all offline.",
  },
  {
    icon: Download,
    title: "Install for Full Power",
    description: "Install SignDocu to your home screen for the fastest offline experience with biometric lock.",
  },
];

export function OfflineDemo({ open, onDismiss }: OfflineDemoProps) {
  const [step, setStep] = useState(0);
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    const accepted = await triggerInstall();
    setInstalling(false);
    if (accepted) {
      toast.success("App installed! Enjoy offline signing 🎉");
    } else if (getInstallPlatform() === 'ios') {
      toast.info("Tap Share → Add to Home Screen to install", { duration: 6000 });
    }
  };

  const CurrentIcon = steps[step].icon;

  return (
    <BottomSheet open={open} onOpenChange={onDismiss} title="How It Works">
      <div className="space-y-6 pb-4">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? "bg-primary w-6" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="text-center space-y-4"
          >
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CurrentIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{steps[step].title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              {steps[step].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl">
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="bg-primary rounded-xl">
              Next
            </Button>
          ) : !isInstalled() ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onDismiss} className="rounded-xl">Not now</Button>
              <Button onClick={handleInstall} disabled={installing} className="bg-gradient-to-r from-primary to-secondary text-white rounded-xl">
                {installing ? "Installing..." : "Install App"}
              </Button>
            </div>
          ) : (
            <Button onClick={onDismiss} className="bg-primary rounded-xl">Got it!</Button>
          )}
        </div>

        {/* Privacy reassurance */}
        <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          End-to-end encrypted • Your data, your control
        </p>
      </div>
    </BottomSheet>
  );
}
