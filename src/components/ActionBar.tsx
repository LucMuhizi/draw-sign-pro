import { Upload, PenTool, FileSignature, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  activeAction?: string;
  onActionClick?: (action: string) => void;
}

const actions = [
  { id: "upload", icon: Upload, label: "Upload" },
  { id: "signature", icon: PenTool, label: "Signature" },
  { id: "add-signature", icon: FileSignature, label: "Add Signature" },
  { id: "download", icon: Download, label: "Download" },
];

export const ActionBar = ({ activeAction, onActionClick }: ActionBarProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border z-50">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-around gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            const isActive = activeAction === action.id;
            
            return (
              <button
                key={action.id}
                onClick={() => onActionClick?.(action.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
