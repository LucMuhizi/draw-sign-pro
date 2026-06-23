import { useState } from "react";
import { UserPlus, Trash2, Copy, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/BottomSheet";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";
import { MultiPartyProgress } from "@/components/animations/MultiPartyProgress";
import type { SigningParticipant } from "@/lib/multiPartySigning";

interface RecipientManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: SigningParticipant[];
  onAddParticipant: (email: string, name: string) => void;
  onRemoveParticipant: (id: string) => void;
  shareUrl?: string;
  onShare: () => void;
}

export function RecipientManager({
  open,
  onOpenChange,
  participants,
  onAddParticipant,
  onRemoveParticipant,
  shareUrl,
  onShare,
}: RecipientManagerProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleAdd = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter an email address");
      return;
    }
    onAddParticipant(trimmedEmail, name.trim() || trimmedEmail.split("@")[0]);
    setEmail("");
    setName("");
    hapticLight();
    toast.success(`Added ${name.trim() || trimmedEmail}`);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      toast.success("Link copied!");
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Recipients" hideClose>
      <div className="space-y-4">
        {/* Phase 9 — multi-party progress line. Shows the satisfying ring
            sequence + animated line segments as recipients sign. */}
        {participants.length > 0 && (
          <MultiPartyProgress participants={participants} compact />
        )}
        {/* Add recipient form */}
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="w-28 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} size="sm" className="bg-primary rounded-xl flex-shrink-0">
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Participants list */}
        {participants.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {participants.length} recipient{participants.length !== 1 ? "s" : ""}
            </p>
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name || p.email}</p>
                    <p className="text-[10px] text-muted-foreground">{p.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    p.status === "signed" ? "bg-success/10 text-success" :
                    p.status === "viewed" ? "bg-primary/10 text-primary" :
                    "bg-muted-foreground/10 text-muted-foreground"
                  }`}>
                    {p.status === "signed" ? "✓ Signed" : p.status === "viewed" ? "Viewed" : "Pending"}
                  </span>
                  <button
                    onClick={() => onRemoveParticipant(p.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Share actions */}
        {shareUrl && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">Sharing link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-muted/50 text-foreground text-xs focus:outline-none truncate"
              />
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="rounded-xl flex-shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={onShare} className="rounded-xl flex-shrink-0">
                <Share2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full rounded-xl">
          Done
        </Button>
      </div>
    </BottomSheet>
  );
}
