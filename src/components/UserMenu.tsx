import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { AuthModal } from './AuthModal';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// Wrap the shadcn Button HOC so we can attach framer-motion's `motion`
// gesture props. Using `motion.Button` (dotted access on an intrinsic
// tag) doesn't work for a custom React component; the canonical pattern
// is the `motion(Component)` factory which yields a forwardRef'd
// motion-wrapped component.
const MotionButton = motion(Button);

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (!user) {
    return (
      <>
        <MotionButton
          variant="outline"
          size="sm"
          onClick={() => setShowAuth(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="h-9 px-3 rounded-xl bg-white/80 backdrop-blur-xl border-border/50 text-muted-foreground hover:text-foreground shadow-soft"
        >
          Sign In
        </MotionButton>
        <AuthModal open={showAuth} onOpenChange={setShowAuth} />
      </>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
  };

  const emailDisplay = user.email
    ? user.email.length > 20
      ? user.email.slice(0, 20) + '…'
      : user.email
    : 'Signed in';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:inline" title={user.email ?? ''}>
        {emailDisplay}
      </span>
      <MotionButton
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="h-9 px-3 rounded-xl bg-white/80 backdrop-blur-xl border-border/50 text-muted-foreground hover:text-destructive shadow-soft"
      >
        Sign Out
      </MotionButton>
    </div>
  );
}
