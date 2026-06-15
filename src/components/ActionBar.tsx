import { Upload, PenTool, FileSignature, Download, History, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StepIndicator } from "./StepIndicator";
import { SettingsDialog } from "./SettingsDialog";

interface ActionBarProps {
  activeAction?: string;
  onActionClick?: (action: string) => void;
}

const actions = [
  { id: "upload", icon: Upload, label: "Upload" },
  { id: "signature", icon: PenTool, label: "Sign" },
  { id: "add-signature", icon: FileSignature, label: "Fields" },
  { id: "download", icon: Download, label: "Done" },
];

export const ActionBar = ({ activeAction, onActionClick }: ActionBarProps) => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
                <motion.button
                  key={action.id}
                  onClick={() => onActionClick?.(action.id)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl relative",
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
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
        <SettingsDialog />
        {mounted && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-xl bg-white/80 backdrop-blur-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-soft"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>
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
