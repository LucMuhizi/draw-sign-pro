import { useState, useEffect } from "react";
import { Settings, Fingerprint, Trash2, Wifi, WifiOff, Cloud, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/BottomSheet";
import { isLockEnabled, setLockEnabled, isBiometricAvailable } from "@/lib/biometricLock";
import { getCacheInfo, clearOfflineCache, isOnline } from "@/lib/offlineMode";
import { getItem, setItem } from "@/lib/storage";
import { toast } from "sonner";

export const SettingsDialog = () => {
  const [open, setOpen] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioActive, setBioActive] = useState(isLockEnabled());
  const [cacheInfo, setCacheInfo] = useState<{ docs: number; sigs: number }>({ docs: 0, sigs: 0 });
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  const refreshCacheInfo = async () => {
    setCacheInfo(await getCacheInfo());
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

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Settings"
        hideClose
      >
        <div className="space-y-5">
          {/* Online/Offline status */}
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

          {/* Biometric Lock */}
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

          {/* Offline Cache */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Cloud className="w-4 h-4 text-muted-foreground" />
              Offline Cache
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {cacheInfo.docs} documents, {cacheInfo.sigs} signatures stored locally
            </p>
            <LastSyncTime />
            {cacheInfo.docs + cacheInfo.sigs > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearCache} className="w-full rounded-xl text-xs">
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Cache
              </Button>
            )}
          </div>

          {/* Privacy reassurance */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Shield className="w-4 h-4 text-success" />
              Privacy
            </div>
            <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
              All document processing happens locally on your device. Cloud sync is optional and off by default. Your signatures and documents are never sent to any server without your explicit action.
            </p>
          </div>

          <Button variant="ghost" onClick={() => setOpen(false)} className="w-full rounded-xl">
            Close
          </Button>
        </div>
      </BottomSheet>
    </>
  );
};

function LastSyncTime() {
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    getItem<{ at: number }>("draw-sign-pro-last-sync").then(data => {
      if (data) setLastSync(new Date(data.at).toLocaleString());
    });

    // Persist current time as the app just launched
    setItem("draw-sign-pro-last-sync", { at: Date.now() });
  }, []);

  if (!lastSync) return null;

  return (
    <p className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
      <Clock className="w-3 h-3" />
      Last active: {lastSync}
    </p>
  );
}
