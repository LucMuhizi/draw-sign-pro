/**
 * Mobile-native bottom sheet wrapper built on shadcn/ui Sheet.
 * Features: drag handle, rounded top corners, backdrop blur, snap-to-fit.
 */
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
  /** Hide the default close X button */
  hideClose?: boolean;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
  hideClose = false,
}: BottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-3xl max-h-[90vh] overflow-y-auto px-5 pb-8 pt-4",
          // Override the default close button when hidden
          hideClose && "[&>button]:hidden",
          className,
        )}
      >
        {/* Drag handle indicator */}
        <div className="mx-auto w-12 h-1.5 bg-muted-foreground/25 rounded-full mb-4" />

        {title && (
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}

        {children}
      </SheetContent>
    </Sheet>
  );
}
