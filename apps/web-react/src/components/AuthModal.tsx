import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { currentUser, emailAuth, requestPasswordReset, resetPassword, socialAuth, startPhoneVerification, verifyEmail, verifyPhoneCode } from '@/lib/api';
import { Button, Input } from '@blinkdotnew/ui';
import { X, Loader2, Mail, Lock, User, Phone } from 'lucide-react';
import { useAccessibleDialog } from '@/hooks/useAccessibleDialog';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path fill="currentColor" d="M21.6 12.23c0-.75-.07-1.47-.19-2.16H12v4.09h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.46Z" />
      <path fill="currentColor" d="M12 22c2.7 0 4.96-.89 6.61-2.41l-3.22-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.75-5.59-4.11H3.08v2.59A9.99 9.99 0 0 0 12 22Z" opacity=".82" />
      <path fill="currentColor" d="M6.41 13.92A6.01 6.01 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.51l3.33-2.59Z" opacity=".64" />
      <path fill="currentColor" d="M12 5.97c1.47 0 2.79.5 3.82 1.49l2.86-2.86C16.95 2.99 14.69 2 12 2a9.99 9.99 0 0 0-8.92 5.49l3.33 2.59C7.2 7.72 9.4 5.97 12 5.97Z" opacity=".9" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path fill="currentColor" d="M3 3h8.4v8.4H3V3Zm9.6 0H21v8.4h-8.4V3ZM3 12.6h8.4V21H3v-8.4Zm9.6 0H21V21h-8.4v-8.4Z" />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [devCode, setDevCode] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [signupPhoneStep, setSignupPhoneStep] = useState<'none' | 'phone' | 'code'>('none');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPhoneCode, setSignupPhoneCode] = useState('');
  const [signupPhoneMessage, setSignupPhoneMessage] = useState('');
  const dialogRef = useAccessibleDialog<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setError('');
      setPendingEmail('');
      setVerificationCode('');
      setVerificationMessage('');
      setDevCode('');
      setResetMode(false);
      setResetEmail('');
      setResetCode('');
      setNewPassword('');
      setResetMessage('');
      setTermsAccepted(false);
      setPrivacyAccepted(false);
      setSignupPhoneStep('none');
      setSignupPhone('');
      setSignupPhoneCode('');
      setSignupPhoneMessage('');
    }
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const closeAfterAuth = () => {
    const user = currentUser();
    onClose();
    if (user && !user.onboardingCompleted) {
      window.setTimeout(() => navigate({ to: '/onboarding' }), 120);
      return;
    }
    if (window.location.pathname === '/signin') {
      window.setTimeout(() => navigate({ to: '/' }), 120);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (pendingEmail) {
        await verifyEmail(pendingEmail, verificationCode);
        if (tab === 'signup') {
          setPendingEmail('');
          setVerificationCode('');
          setVerificationMessage('');
          setDevCode('');
          setSignupPhoneStep('phone');
          setSignupPhoneMessage('Add a phone number so Kerodex can send a one-time verification code.');
          return;
        }
        closeAfterAuth();
        return;
      }

      if (signupPhoneStep === 'phone') {
        const clean = signupPhone.replace(/\D/g, '');
        if (clean.length < 10) {
          setError('Enter a valid phone number.');
          return;
        }
        const result = await startPhoneVerification(signupPhone);
        setSignupPhoneMessage(result.message || 'Verification code sent.');
        setSignupPhoneStep('code');
        return;
      }

      if (signupPhoneStep === 'code') {
        if (signupPhoneCode.length < 4) {
          setError('Enter the verification code we sent to your phone.');
          return;
        }
        await verifyPhoneCode(signupPhone, signupPhoneCode);
        closeAfterAuth();
        return;
      }

      if (resetMode) {
        if (resetEmail && resetCode) {
          await resetPassword(resetEmail, resetCode, newPassword);
          closeAfterAuth();
          return;
        }
        const result = await requestPasswordReset(email);
        setResetEmail(result.email);
        setResetMessage(result.message || result.error || 'Enter the reset code we sent to your email.');
        setDevCode(result.devCode || '');
        setResetCode(result.devCode || '');
        return;
      }

      if (tab === 'signup' && (!termsAccepted || !privacyAccepted)) {
        setError('Agree to the Terms of Service and Privacy Policy before creating an account.');
        return;
      }

      const result = await emailAuth(
        tab === 'signup' ? 'create' : 'signin',
        email,
        password,
        name,
        tab === 'signup' ? { termsAccepted, privacyAccepted } : undefined
      );
      if ('requiresVerification' in result) {
        setPendingEmail(result.email);
        setVerificationMessage(result.message || result.error || 'Enter the verification code we sent to your email.');
        setDevCode(result.devCode || '');
        setVerificationCode(result.devCode || '');
        return;
      }
      closeAfterAuth();
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
        ref={dialogRef}
        id="auth-modal"
        className="bg-background border border-border w-full max-w-md mx-4 p-8 relative"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create account"
        tabIndex={-1}
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
            {pendingEmail
              ? 'Verify email'
              : signupPhoneStep !== 'none'
              ? 'Verify phone'
              : resetMode
              ? (resetEmail ? 'Enter reset code' : 'Reset password')
              : tab === 'login'
              ? 'Welcome back'
              : 'Create account'}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {pendingEmail
              ? verificationMessage
              : signupPhoneStep !== 'none'
              ? signupPhoneMessage || 'Verify your phone number to finish setting up your Kerodex account.'
              : resetMode
              ? resetEmail
                ? resetMessage
                : 'Enter your email and we will send a password reset code.'
              : tab === 'login'
              ? 'Sign in to your Kerodex account to continue.'
              : 'Join Kerodex to buy and sell vehicles with confidence.'}
          </p>
        </div>

        {/* Tab Toggle */}
        {!pendingEmail && signupPhoneStep === 'none' && !resetMode && <div className="flex border border-border mb-8" role="tablist">
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
        </div>}

        <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
          {pendingEmail ? (
            <>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="auth-verification-code"
                  name="verificationCode"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit verification code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="pl-10 h-11 text-[13px]"
                  required
                />
              </div>
              {devCode && (
                <p className="text-[12px] text-muted-foreground">
                  Local dev code: <span className="font-mono text-foreground">{devCode}</span>
                </p>
              )}
            </>
          ) : signupPhoneStep !== 'none' ? (
            <>
              {signupPhoneStep === 'phone' ? (
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    className="pl-10 h-11 text-[13px]"
                    required
                    autoComplete="tel"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-phone-code"
                    name="phoneCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="Verification code"
                    value={signupPhoneCode}
                    onChange={(e) => setSignupPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-10 h-11 text-[13px]"
                    required
                  />
                </div>
              )}
              <p className="text-[12px] text-muted-foreground">
                Kerodex uses this to reduce fake accounts and suspicious marketplace activity. Do not share your code with anyone.
              </p>
              {signupPhoneStep === 'code' && (
                <button
                  type="button"
                  onClick={() => {
                    setSignupPhoneStep('phone');
                    setSignupPhoneCode('');
                    setError('');
                  }}
                  className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Use a different phone number
                </button>
              )}
            </>
          ) : resetMode ? (
            <>
              {!resetEmail ? (
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-reset-email"
                    name="resetEmail"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 text-[13px]"
                    required
                    autoComplete="email"
                  />
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="auth-reset-code"
                      name="resetCode"
                      type="text"
                      inputMode="numeric"
                      placeholder="6-digit reset code"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="pl-10 h-11 text-[13px]"
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="auth-new-password"
                      name="newPassword"
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 h-11 text-[13px]"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}
              {devCode && (
                <p className="text-[12px] text-muted-foreground">
                  Local dev code: <span className="font-mono text-foreground">{devCode}</span>
                </p>
              )}
            </>
          ) : <>
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
          {tab === 'login' && (
            <button
              type="button"
              onClick={() => { setResetMode(true); setError(''); setEmail(email); }}
              className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Forgot password?
            </button>
          )}
          {tab === 'signup' && (
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 text-left text-[12px] text-muted-foreground leading-relaxed">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-foreground"
                  required
                />
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2 text-foreground">
                    Terms of Service
                  </a>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 text-left text-[12px] text-muted-foreground leading-relaxed">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-foreground"
                  required
                />
                <span>
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 text-foreground">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </div>
          )}
          </>}

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
            ) : pendingEmail ? (
              'Verify Email'
            ) : signupPhoneStep === 'phone' ? (
              'Send Phone Code'
            ) : signupPhoneStep === 'code' ? (
              'Verify Phone'
            ) : resetMode ? (
              resetEmail ? 'Reset Password' : 'Send Reset Code'
            ) : tab === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        {resetMode && (
          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetEmail('');
              setResetCode('');
              setNewPassword('');
              setDevCode('');
              setError('');
            }}
            className="mt-4 text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Back to sign in
          </button>
        )}

        {!pendingEmail && signupPhoneStep === 'none' && !resetMode && <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 text-[11px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
            onClick={async () => {
              setError('');
              if (tab === 'signup' && (!termsAccepted || !privacyAccepted)) {
                setError('Agree to the Terms of Service and Privacy Policy before creating an account.');
                return;
              }
              setIsLoading(true);
              try {
                await socialAuth('google', tab === 'signup' ? { termsAccepted, privacyAccepted } : undefined);
                onClose();
              } catch (err: any) {
                setError(err.message || 'Google sign in failed');
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <GoogleLogo />
            Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 text-[11px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2"
            onClick={async () => {
              setError('');
              if (tab === 'signup' && (!termsAccepted || !privacyAccepted)) {
                setError('Agree to the Terms of Service and Privacy Policy before creating an account.');
                return;
              }
              setIsLoading(true);
              try {
                await socialAuth('microsoft', tab === 'signup' ? { termsAccepted, privacyAccepted } : undefined);
                onClose();
              } catch (err: any) {
                setError(err.message || 'Microsoft sign in failed');
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <MicrosoftLogo />
            Microsoft
          </Button>
        </div>}

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
