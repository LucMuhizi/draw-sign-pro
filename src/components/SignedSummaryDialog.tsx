import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Copy, Download, Check, Hash, Users, FileText, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/BottomSheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  copyPayload,
  type SignatureSummary,
  type SignerEntry,
} from "@/lib/auditTrail";

/**
 * Format a 64-char hex SHA-256 into the
 * `xxxxxxxx…xxxxxxxx` truncated view used in the dialog body. Full
 * hex remains copyable via the dedicated copy button.
 */
function shortHash(hash: string): string {
  if (!hash || hash.length <= 16) return hash || "(not measured)";
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

interface SignedSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: SignatureSummary | null;
}

/**
 * The receipt shown right after a successful download. Persists until
 * dismissed so the user has time to copy the hash to their clipboard
 * or download the JSON for audit logs.
 *
 * Implementation notes:
 * - `copyResetTimerRef` holds the in-flight timer so we can clear it
 *   on unmount and avoid React's "state update on unmounted
 *   component" warning if the user dismisses mid-feedback.
 * - `key` is implicit via the parent; if the parent remounts this
 *   dialog (e.g. on route change), the cleanup runs naturally.
 * - Per-signer contributions come from the model directly
 *   (`signer.placementsCount`), not from a brittle position-based
 *   heuristic across the list.
 */
export function SignedSummaryDialog({
  open,
  onOpenChange,
  summary,
}: SignedSummaryDialogProps) {
  const [copiedField, setCopiedField] = useState<"input-hash" | "output-hash" | "full" | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the copy-feedback timer on unmount so a state update
  // isn't fired on a component that's already gone.
  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, []);

  const textPayload = useMemo(
    () => (summary ? copyPayload(summary) : ""),
    [summary],
  );

  const jsonPayload = useMemo(
    () => (summary ? JSON.stringify(summary, null, 2) : ""),
    [summary],
  );

  const handleCopy = useCallback(
    async (text: string, field: "input-hash" | "output-hash" | "full") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        if (copyResetTimerRef.current !== null) {
          clearTimeout(copyResetTimerRef.current);
        }
        copyResetTimerRef.current = setTimeout(() => {
          setCopiedField((cur) => (cur === field ? null : cur));
          copyResetTimerRef.current = null;
        }, 1600);
      } catch {
        toast.error("Could not copy to clipboard");
      }
    },
    [],
  );

  const handleDownloadJson = useCallback(() => {
    if (!summary) return;
    try {
      const blob = new Blob([jsonPayload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = summary.documentName.replace(/[^a-z0-9._-]+/gi, "_");
      a.href = url;
      a.download = `${safeName}.signature-receipt.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not save receipt");
    }
  }, [jsonPayload, summary]);

  if (!summary) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Signing Receipt">
        <div className="text-sm text-muted-foreground text-center py-6">
          No receipt available.
        </div>
      </BottomSheet>
    );
  }

  const contributorsCount = summary.signers.filter((s) => s.placementsCount > 0).length;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Signing receipt"
      description={summary.documentName}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="space-y-5 pt-1"
      >
        {/* Hash card */}
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Hash className="w-3.5 h-3.5" /> SHA-256 (input document)
          </div>
          <div className="flex items-center justify-between gap-3">
            <code className="font-mono text-sm truncate" title={summary.documentHash}>
              {shortHash(summary.documentHash)}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => handleCopy(summary.documentHash, "input-hash")}
              aria-label="Copy SHA-256 hash"
            >
              {copiedField === "input-hash" ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          {summary.outputHash && (
            <>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground pt-1">
                <FileText className="w-3.5 h-3.5" /> SHA-256 (signed output)
              </div>
              <div className="flex items-center justify-between gap-3">
                <code className="font-mono text-sm truncate" title={summary.outputHash}>
                  {shortHash(summary.outputHash)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => handleCopy(summary.outputHash, "output-hash")}
                  aria-label="Copy output SHA-256 hash"
                >
                  {copiedField === "output-hash" ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Timestamp + counts row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              <Clock className="w-3 h-3" /> Signed
            </div>
            <div className="text-sm font-medium">
              {new Date(summary.signedAt).toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate" title={`ISO ${new Date(summary.signedAt).toISOString()}`}>
              ISO {new Date(summary.signedAt).toISOString()}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              <FileText className="w-3 h-3" /> Fields
            </div>
            <div className="text-sm font-medium">
              {summary.placements.totalFields}
              <span className="text-muted-foreground text-xs ml-1">
                across {Object.keys(summary.placements.perPage).length} page(s)
              </span>
            </div>
          </div>
        </div>

        {/* Signers */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Users className="w-3.5 h-3.5" /> Signers ({summary.signers.length})
            </div>
            {contributorsCount > 0 && (
              <div className="text-[10px] text-muted-foreground">
                {contributorsCount} contributed
              </div>
            )}
          </div>
          {summary.signers.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No signers recorded.</div>
          ) : (
            <ul className="space-y-2">
              {summary.signers.map((s) => (
                <SignerRow key={s.id} signer={s} />
              ))}
            </ul>
          )}
        </div>

        {/* Footer actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(textPayload, "full")}
            className="h-9"
          >
            {copiedField === "full" ? (
              <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 mr-1.5" />
            )}
            Copy receipt
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadJson}
            className="h-9"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Save JSON
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          This receipt is a verifiable reference — it is{" "}
          <span className="font-medium text-foreground">not</span> a legal
          digital signature.
        </p>
      </motion.div>
    </BottomSheet>
  );
}

function SignerRow({ signer }: { signer: SignerEntry }) {
  // Derive initials from the best-available display string. Falls back to
  // a question mark if both name and email are blank so the avatar
  // never renders empty.
  const displayName = signer.name?.trim() || signer.email || "?";
  const initials = (signer.name || signer.email || "??").slice(0, 2).toUpperCase();
  const roleStyles: Record<SignerEntry["role"], string> = {
    owner: "bg-primary/15 text-primary",
    signer: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    witness: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    cc: "bg-secondary text-muted-foreground",
  };
  return (
    <li
      className="flex items-center gap-3"
      title={displayName}
    >
      <div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center text-[11px] font-semibold tracking-wide shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {displayName}
        </div>
        {signer.name && (
          <div className="text-[11px] text-muted-foreground truncate">
            {signer.email}
          </div>
        )}
      </div>
      <span
        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${roleStyles[signer.role]}`}
      >
        {signer.role}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">
        {signer.placementsCount}f
      </span>
    </li>
  );
}
