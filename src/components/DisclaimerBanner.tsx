import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert, X } from "lucide-react";
import { getItem, setItem } from "@/lib/storage";
import { DISCLAIMER_DISMISS_KEY, DISCLAIMER_SHORT } from "@/lib/disclaimer";

/**
 * Phase 1 P1.1 — Dismissable disclaimer banner.
 *
 * Reads `DISCLAIMER_DISMISS_KEY` from local storage. If the user has
 * dismissed it once, never shows again. Otherwise, shows above the
 * upload zone on `/`.
 *
 * Tapping "Read more" opens the Settings → About → Legal notice (driven
 * by a custom event; SettingsDialog listens). Tapping "Got it" persists
 * dismissal and slides the banner out.
 *
 * Compact: 1-line + dismiss X. Keeps first-paint surface area small so
 * the upload zone is still primary.
 */
export function DisclaimerBanner() {
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seen = await getItem<{ at: number }>(DISCLAIMER_DISMISS_KEY);
      if (cancelled) return;
      setVisible(!seen);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    await setItem(DISCLAIMER_DISMISS_KEY, { at: Date.now() });
    setVisible(false);
  };

  const openDetails = () => {
    window.dispatchEvent(new CustomEvent("signdocu:open-legal-notice"));
  };

  if (!hydrated) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="disclaimer-banner"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="overflow-hidden mb-3"
        >
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50/80 backdrop-blur px-3 py-2 text-xs text-amber-900 shadow-soft"
          >
            <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" aria-hidden />
            <p className="flex-1 leading-snug">
              <strong className="font-semibold">Heads up:</strong> {DISCLAIMER_SHORT}{" "}
              <button
                onClick={openDetails}
                className="underline underline-offset-2 font-medium hover:text-amber-700"
              >
                Read more
              </button>
            </p>
            <button
              onClick={dismiss}
              aria-label="Dismiss disclaimer"
              className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-amber-700/70 hover:text-amber-900 hover:bg-amber-100/60 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
