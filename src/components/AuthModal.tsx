import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setSubmitting(true);

    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (mode === 'signup') {
      toast.success('Account created! Check your email for confirmation.');
    } else {
      toast.success('Signed in successfully!');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white/90 backdrop-blur-2xl border border-border/50">
        <DialogHeader>
          <DialogTitle className="text-foreground">{mode === 'signin' ? 'Sign In' : 'Create Account'}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === 'signin'
              ? 'Sign in to sync your signatures and document history'
              : 'Create an account to save your signatures to the cloud'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              required
              minLength={6}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow transition-all h-11 rounded-xl font-semibold"
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {mode === 'signin' ? (
              <>Don't have an account? <button type="button" onClick={() => setMode('signup')} className="text-primary font-medium hover:underline">Sign up</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => setMode('signin')} className="text-primary font-medium hover:underline">Sign in</button></>
            )}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
