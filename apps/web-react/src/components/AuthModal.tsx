import { useEffect, useState } from 'react';
import { emailAuth, socialAuth } from '@/lib/api';
import { Button, Input } from '@blinkdotnew/ui';
import { X, Loader2, Mail, Lock, User } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setTab(defaultTab);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await emailAuth(tab === 'signup' ? 'create' : 'signin', email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        id="auth-modal"
        className="bg-background border border-border w-full max-w-md mx-4 p-8 relative"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create account"
      >
        <button
          id="auth-modal-close"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-8">
          <h2 className="text-xl font-bold tracking-tight mb-1">
            {tab === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {tab === 'login'
              ? 'Sign in to your Kerodex account to continue.'
              : 'Join Kerodex to buy and sell vehicles with confidence.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex border border-border mb-8" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'login'}
            data-tab="login"
            onClick={() => setTab('login')}
            className={`flex-1 py-2.5 text-[12px] font-bold uppercase tracking-widest transition-colors ${
              tab === 'login' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            data-tab="signup"
            onClick={() => setTab('signup')}
            className={`flex-1 py-2.5 text-[12px] font-bold uppercase tracking-widest transition-colors ${
              tab === 'signup' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-name"
                name="name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 h-11 text-[13px]"
                autoComplete="name"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="auth-email"
              name="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11 text-[13px]"
              required
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="auth-password"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-11 text-[13px]"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p id="auth-error" className="text-[12px] text-destructive">{error}</p>
          )}

          <Button
            id="auth-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full h-11 text-[12px] font-bold uppercase tracking-widest mt-6"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Please wait...</>
            ) : tab === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 text-[11px] font-bold uppercase tracking-wider"
            onClick={async () => {
              setError('');
              setIsLoading(true);
              try {
                await socialAuth('google');
                onClose();
              } catch (err: any) {
                setError(err.message || 'Google sign in failed');
              } finally {
                setIsLoading(false);
              }
            }}
          >
            Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-[11px] font-bold uppercase tracking-wider"
            onClick={async () => {
              setError('');
              setIsLoading(true);
              try {
                await socialAuth('apple');
                onClose();
              } catch (err: any) {
                setError(err.message || 'Apple sign in failed');
              } finally {
                setIsLoading(false);
              }
            }}
          >
            Apple
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-[12px] text-muted-foreground">
            By continuing you agree to our{' '}
            <a href="/terms" className="underline underline-offset-2">Terms</a>{' '}
            and{' '}
            <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
