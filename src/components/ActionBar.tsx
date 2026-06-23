import { Upload, PenTool, FileSignature, Download, History, Sun, Moon, Zap, Cloud, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PressableButton } from "@/components/animations/PressableButton";
import { StepIndicator } from "./StepIndicator";
import { SettingsDialog } from "./SettingsDialog";
import { isQuickSignEnabled, saveProfile, getProfile } from "@/lib/userProfile";
import { isOnline, onOnlineChange } from "@/lib/offlineMode";
import { toast } from "sonner";

interface ActionBarProps {
  activeAction?: string;
  onActionClick?: (action: string) => void;
  onQuickSignToggle?: (enabled: boolean) => void;
}

const actions = [
  { id: "upload", icon: Upload, label: "Upload" },
  { id: "signature", icon: PenTool, label: "Sign" },
  { id: "add-signature", icon: FileSignature, label: "Fields" },
  { id: "download", icon: Download, label: "Done" },
];

export const ActionBar = ({ activeAction, onActionClick, onQuickSignToggle }: ActionBarProps) => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [quickSignOn, setQuickSignOn] = useState(false);
  const [online, setOnline] = useState(isOnline());

  // Phase 10 — offline indicator. Track the previous online state so we can
  // fire a one-shot sync-ripple when the network comes back online.
  const prevOnline = useRef(online);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    isQuickSignEnabled().then(setQuickSignOn);
  }, []);
  useEffect(() => {
    return onOnlineChange(setOnline);
  }, []);

  useEffect(() => {
    if (prevOnline.current === false && online === true) {
      setJustReconnected(true);
      const t = window.setTimeout(() => setJustReconnected(false), 700);
      prevOnline.current = online;
      return () => window.clearTimeout(t);
    }
    prevOnline.current = online;
    return undefined;
  }, [online]);

  const handleQuickSignToggle = useCallback(async () => {
    const next = !quickSignOn;
    setQuickSignOn(next);
    await saveProfile({ quickSignEnabled: next });
    onQuickSignToggle?.(next);
    if (next) {
      const profile = await getProfile();
      if (!profile.displayName) {
        toast.info("Set your display name first — tap the signature tab and type your name");
      } else {
        toast.success("Quick Sign enabled — signature auto-placed after upload");
      }
    } else {
      toast.success("Quick Sign disabled — manual mode");
    }
  }, [quickSignOn, onQuickSignToggle]);

  return (
    <>
      <StepIndicator activeStep={activeAction || 'upload'} onStepClick={onActionClick} />

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-white/80 backdrop-blur-2xl border-t border-border/50">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-around">
            {actions.map((action) => {
              const Icon = action.icon;
              const isActive = activeAction === action.id;

              return (
                <PressableButton
                  key={action.id}
                  onClick={() => onActionClick?.(action.id)}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl relative bg-transparent",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-bg"
                      className="absolute inset-0 bg-primary/10 rounded-2xl"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className="w-5 h-5 relative" />
                  <span className="text-[10px] font-semibold relative">{action.label}</span>
                </PressableButton>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
        {/* Offline-first badge — Phase 10: cloud ↔ device morph, text swap, sync ripple on reconnect. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors shadow-soft relative overflow-visible",
            online
              ? "bg-green-50/80 backdrop-blur-xl border-green-200 text-green-700"
              : "bg-amber-50/80 backdrop-blur-xl border-amber-200 text-amber-700"
          )}
          aria-live="polite"
          title={online ? "Synced with cloud" : "Working offline — changes will sync when connection returns"}
        >
          {/* Sync ripple — fires once when the network comes back online. */}
          {justReconnected && (
            <span
              key="ripple"
              aria-hidden
              className="absolute inset-0 rounded-full animate-sync-ripple bg-green-400/40 pointer-events-none"
            />
          )}
          <AnimatePresence mode="wait" initial={false}>
            {online ? (
              <motion.span
                key="online"
                className="flex items-center gap-1.5"
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 6, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Cloud className="w-3 h-3" />
                Synced
              </motion.span>
            ) : (
              <motion.span
                key="offline"
                className="flex items-center gap-1.5"
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 6, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Smartphone className="w-3 h-3" />
                Working Offline
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
        <PressableButton
          onClick={handleQuickSignToggle}
          className={cn(
            "w-9 h-9 rounded-xl border flex items-center justify-center transition-all shadow-soft",
            quickSignOn
              ? "bg-primary text-primary-foreground border-primary shadow-glow"
              : "bg-white/80 backdrop-blur-xl border-border/50 text-muted-foreground hover:text-foreground"
          )}
          title={quickSignOn ? "Quick Sign: ON" : "Quick Sign: OFF"}
        >
          <Zap className="w-4 h-4" />
        </PressableButton>
        <SettingsDialog />
        {mounted && (
          <PressableButton
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-xl bg-white/80 backdrop-blur-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-soft"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </PressableButton>
        )}
        {user && (
          <motion.a
            href="/history"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="w-9 h-9 rounded-xl bg-white/80 backdrop-blur-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-soft"
          >
            <History className="w-4 h-4" />
          </motion.a>
        )}
        <UserMenu />
      </div>
    </>
  );
};
