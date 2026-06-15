import { useState, useEffect } from "react";
import { Settings, Fingerprint, Trash2, Wifi, WifiOff, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { isLockEnabled, setLockEnabled, isBiometricAvailable } from "@/lib/biometricLock";
import { getCacheInfo, clearOfflineCache, isOnline } from "@/lib/offlineMode";
import { toast } from "sonner";

export const SettingsDialog = () => {
  const [open, setOpen] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioActive, setBioActive] = useState(isLockEnabled());
  const [cacheInfo, setCacheInfo] = useState(getCacheInfo);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  const refreshCacheInfo = () => {
    setCacheInfo(getCacheInfo());
    setOnline(isOnline());
  };

  useEffect(() => {
    if (open) refreshCacheInfo();
  }, [open]);

  const handleToggleBio = () => {
    const next = !bioActive;
    setLockEnabled(next);
    setBioActive(next);
    toast.success(next ? "Biometric lock enabled" : "Biometric lock disabled");
  };

  const handleClearCache = async () => {
    await clearOfflineCache();
    refreshCacheInfo();
    toast.success("Offline cache cleared");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-xl bg-white/80 backdrop-blur-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-soft"
      >
        <Settings className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <Card className="p-6 w-80 bg-white/95 backdrop-blur-xl border border-border/50 shadow-xl rounded-2xl space-y-5">
                <h2 className="font-semibold text-lg text-foreground">Settings</h2>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      {online ? <Wifi className="w-4 h-4 text-success" /> : <WifiOff className="w-4 h-4 text-warning" />}
                      {online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                  {!online && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {cacheInfo.docs} cached documents, {cacheInfo.sigs} cached signatures
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Fingerprint className="w-4 h-4 text-primary" />
                      Biometric Lock
                    </div>
                    <button
                      onClick={handleToggleBio}
                      disabled={!bioAvailable}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        bioActive ? 'bg-primary' : bioAvailable ? 'bg-muted-foreground/30' : 'bg-muted-foreground/10'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                        bioActive ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  {!bioAvailable && (
                    <p className="text-xs text-muted-foreground pl-6">Not available on this device</p>
                  )}
                  {bioAvailable && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {bioActive ? 'Fingerprint or face required to access' : 'Optional security measure'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Cloud className="w-4 h-4 text-muted-foreground" />
                    Offline Cache
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    {cacheInfo.docs} documents, {cacheInfo.sigs} signatures cached
                  </p>
                  {cacheInfo.docs + cacheInfo.sigs > 0 && (
                    <Button variant="outline" size="sm" onClick={handleClearCache} className="w-full rounded-xl text-xs">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear Cache
                    </Button>
                  )}
                </div>

                <Button variant="ghost" onClick={() => setOpen(false)} className="w-full rounded-xl">
                  Close
                </Button>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
