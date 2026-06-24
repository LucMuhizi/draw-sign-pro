import { Users, Info } from "lucide-react";
import { MultiPartyProgress } from "@/components/animations/MultiPartyProgress";
import { PageThumbnailSidebar } from "@/components/document-viewer/PageThumbnailSidebar";
import { cn } from "@/lib/utils";
import type { SigningParticipant } from "@/lib/multiPartySigning";
import type { SignaturePlacement } from "@/lib/pdfSigner";

/**
 * Phase 2 P2.3 — right-side panel that appears next to the main PDF canvas
 * at the tablet/desktop breakpoint (>= 1024px).
 *
 * Stacks three sections vertically:
 *   1. **Signers** — expanded MultiPartyProgress with all signers, their
 *      per-user progress ring, and the live "X of Y signed" line. Hidden
 *      when the session is single-party (no participants).
 *   2. **Role legend** — small footnote showing what owner / signer /
 *      witness / cc mean. Same conditional visibility as Signers.
 *   3. **Page thumbnails** — reuses the existing PageThumbnailSidebar
 *      inside the panel instead of letting it float to the LEFT of the
 *      page column. Hidden when the PDF has a single page (the dots
 *      indicator already covers that case inside DocumentRenderer).
 *
 * Why a single panel instead of three sibling widgets:
 *   - All three pieces share the same breakpoint (only show >= 1024px)
 *     and the same "always-on-when-present" blank-state behaviour.
 *     Combining them keeps DocumentViewer flat and lets the panel own
 *     the "no signers + no thumbnails = render nothing" gating rule.
 *   - Vertical scroll on the panel itself prevents the right column from
 *     clipping on shorter viewports (e.g. iPad portrait 1024x1366 is
 *     rendered as 820 wide after rotation -> tall panel).
 *
 * Width: 288px (`w-72`) by default, scales to 320px (`xl:w-80`) on
 * extra-wide desktop so the panel doesn't feel cramped at 2560x1440.
 */
interface TabletSidebarPanelProps {
  fileUrl: string;
  numPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  signatures: SignaturePlacement[];
  participants: SigningParticipant[];
  currentRecipientId?: string;
}

const ROLE_LEGEND: Array<{
  label: "Owner" | "Signer" | "Witness" | "CC";
  role: "owner" | "signer" | "witness" | "cc";
  description: string;
}> = [
  { label: "Owner", role: "owner", description: "Document creator / sender" },
  { label: "Signer", role: "signer", description: "Adds a signature" },
  { label: "Witness", role: "witness", description: "Witnesses signing event" },
  { label: "CC", role: "cc", description: "Receives a copy, doesn't sign" },
];

const ROLE_LABEL_COLOR: Record<
  "owner" | "signer" | "witness" | "cc",
  string
> = {
  owner: "text-primary",
  signer: "text-success",
  witness: "text-warning",
  cc: "text-muted-foreground",
};

export function TabletSidebarPanel({
  fileUrl,
  numPages,
  currentPage,
  onPageChange,
  signatures,
  participants,
  currentRecipientId,
}: TabletSidebarPanelProps) {
  const showSigners = participants.length > 0;
  const showThumbnails = numPages > 1;

  // No contents for this viewport — render nothing. Caller still wraps us
  // in `hidden lg:flex`, but returning null here also lets callers compose
  // us in arbitrary layouts without leakage.
  if (!showSigners && !showThumbnails) return null;

  return (
    <aside
      className="hidden lg:flex flex-col gap-3 w-72 xl:w-80 flex-shrink-0 p-3 bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl max-h-[85vh] overflow-y-auto scrollbar-thin"
      aria-label="Signing session sidebar"
      data-testid="tablet-sidebar-panel"
    >
      {showSigners && (
        <section className="space-y-2" aria-labelledby="signers-heading">
          <h3
            id="signers-heading"
            className="text-xs font-semibold text-foreground flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-primary" />
            Signers
          </h3>
          <div className="bg-card/60 rounded-lg p-3 border border-border/30">
            {/*
              Compact would normally be set inside RecipientManager; the right
              panel has more vertical room so we render the full expanded
              variant. Pass currentRecipientId so the active participant's
              avatar gets the accent ring.
            */}
            <MultiPartyProgress
              participants={participants}
              currentRecipientId={currentRecipientId}
            />
          </div>
          <div
            className="bg-card/60 rounded-lg p-2.5 border border-border/30 space-y-1.5"
            aria-labelledby="role-legend-heading"
          >
            <h4
              id="role-legend-heading"
              className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"
            >
              <Info className="w-3 h-3" />
              Role legend
            </h4>
            {ROLE_LEGEND.map(({ label, role, description }) => (
              <div key={role} className="flex items-baseline gap-2 text-[11px] leading-tight">
                <span
                  className={cn(
                    "font-mono font-semibold uppercase tracking-wide w-12 flex-shrink-0",
                    ROLE_LABEL_COLOR[role],
                  )}
                >
                  {label}
                </span>
                <span className="text-muted-foreground">{description}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {showSigners && showThumbnails && (
        <div className="border-t border-border/50" aria-hidden />
      )}

      {showThumbnails && (
        <section aria-labelledby="thumbnails-heading">
          <h3
            id="thumbnails-heading"
            className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between"
          >
            <span>Pages</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {currentPage} / {numPages}
            </span>
          </h3>
          {/*
            PageThumbnailSidebar's own root uses `hidden md:flex`. At >= lg
            (where this panel mounts) the inner class resolves to flex, so
            the thumbs always render when the panel is visible. We rely on
            LinuxSafari Mac and Chrome both honouring nested hidden classes
            the same way; tested behaviour matches the rest of the app.
          */}
          <div className="-mx-1">
            <PageThumbnailSidebar
              fileUrl={fileUrl}
              numPages={numPages}
              currentPage={currentPage}
              onPageChange={onPageChange}
              signatures={signatures}
            />
          </div>
        </section>
      )}
    </aside>
  );
}
