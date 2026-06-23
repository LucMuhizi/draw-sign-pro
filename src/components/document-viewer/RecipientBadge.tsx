import type { SigningParticipant } from "@/lib/multiPartySigning";

interface RecipientBadgeProps {
  participant: SigningParticipant;
  small?: boolean;
}

export function RecipientBadge({ participant, small }: RecipientBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap ${
        small ? "text-[9px]" : "text-[10px]"
      }`}
      style={{
        backgroundColor: participant.color + "18",
        borderColor: participant.color + "40",
        color: participant.color,
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: participant.color }}
      />
      {participant.name || participant.email}
      {!small && participant.status === "signed" && " ✓"}
    </span>
  );
}
