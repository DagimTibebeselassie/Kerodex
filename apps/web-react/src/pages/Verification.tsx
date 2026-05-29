import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  Shield, BadgeCheck, Phone, Mail, User, FileText, Camera,
  CheckCircle2, Clock, ChevronRight, Lock, AlertTriangle, Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type VerifStatus = 'not_started' | 'pending' | 'verified' | 'failed';

interface VerifStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: VerifStatus;
  points: number;
  required: boolean;
}

// ── Step Card ─────────────────────────────────────────────────────────────
function StepCard({
  step,
  onStart,
}: {
  step: VerifStep;
  onStart: (id: string) => void;
}) {
  const statusConfig = {
    not_started: {
      badge: 'Not Started',
      badgeClass: 'border-border text-muted-foreground',
      actionLabel: 'Start',
      canStart: true,
    },
    pending: {
      badge: 'In Review',
      badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
      actionLabel: 'Pending',
      canStart: false,
    },
    verified: {
      badge: 'Verified',
      badgeClass: 'border-primary/30 bg-primary/10 text-primary',
      actionLabel: 'Done',
      canStart: false,
    },
    failed: {
      badge: 'Failed',
      badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
      actionLabel: 'Retry',
      canStart: true,
    },
  };

  const cfg = statusConfig[step.status];

  return (
    <div className={`p-5 border transition-colors ${
      step.status === 'verified'
        ? 'border-primary/20 bg-card'
        : 'border-border bg-card hover:border-primary/30'
    }`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
          step.status === 'verified' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {step.status === 'verified'
            ? <CheckCircle2 className="h-5 w-5" />
            : step.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-bold">{step.title}</h3>
            {step.required && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400">
                Required
              </span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border ${cfg.badgeClass}`}>
              {cfg.badge}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1">{step.description}</p>
          <div className="flex items-center gap-1 mt-2">
            <Shield className="h-3 w-3 text-primary" />
            <span className="text-[11px] text-primary font-bold">+{step.points} trust points</span>
          </div>
        </div>

        {/* Action */}
        {cfg.canStart && (
          <Button
            variant={step.status === 'not_started' ? 'outline' : 'default'}
            className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider shrink-0"
            onClick={() => onStart(step.id)}
          >
            {cfg.actionLabel}
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
        {step.status === 'pending' && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-500 shrink-0">
            <Clock className="h-3.5 w-3.5" />
            Review
          </div>
        )}
        {step.status === 'verified' && (
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}

// ── Phone Verification Modal ───────────────────────────────────────────────
function PhoneVerifModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setStep('code');
    toast.success('Verification code sent to your phone.');
  };

  const handleVerify = async () => {
    if (code !== '123456') {
      toast.error('Invalid code. (Demo: use 123456)');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    toast.success('Phone verified!');
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border w-full max-w-sm mx-4 p-8 space-y-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Phone Verification</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            {step === 'phone'
              ? 'Enter your phone number to receive a verification code.'
              : 'Enter the 6-digit code we sent to your phone.'}
          </p>
        </div>

        {step === 'phone' ? (
          <>
            <Input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 text-[13px]"
              autoFocus
            />
            <Button
              onClick={handleSendCode}
              disabled={loading || !phone.trim()}
              className="w-full h-11 text-[12px] font-bold uppercase tracking-widest"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Code'}
            </Button>
          </>
        ) : (
          <>
            <Input
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="h-11 text-[13px] font-mono tracking-[0.3em] text-center"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground -mt-4">Demo code: 123456</p>
            <Button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full h-11 text-[12px] font-bold uppercase tracking-widest"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function VerificationPage() {
  const { user, login, isLoading: authLoading } = useAuth();

  const [steps, setSteps] = useState<VerifStep[]>([
    {
      id: 'email',
      title: 'Email Verification',
      description: 'Confirm your email address to prove you have access to it.',
      icon: <Mail className="h-5 w-5" />,
      status: 'verified',
      points: 10,
      required: true,
    },
    {
      id: 'phone',
      title: 'Phone Number',
      description: 'Verify your mobile number via SMS. Required for messaging sellers.',
      icon: <Phone className="h-5 w-5" />,
      status: 'not_started',
      points: 20,
      required: true,
    },
    {
      id: 'identity',
      title: 'Identity Verification (Gov ID)',
      description: 'Upload a government-issued ID (license, passport, or state ID).',
      icon: <FileText className="h-5 w-5" />,
      status: 'not_started',
      points: 35,
      required: false,
    },
    {
      id: 'selfie',
      title: 'Selfie Match',
      description: 'Take a selfie to match against your government ID for full verification.',
      icon: <Camera className="h-5 w-5" />,
      status: 'not_started',
      points: 25,
      required: false,
    },
  ]);

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [idUploading, setIdUploading] = useState(false);

  const markVerified = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'verified' } : s))
    );
  };

  const markPending = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'pending' } : s))
    );
  };

  const handleStart = async (id: string) => {
    if (id === 'phone') {
      setPhoneModalOpen(true);
    } else if (id === 'identity') {
      // Simulate upload flow
      setIdUploading(true);
      await new Promise((r) => setTimeout(r, 1500));
      setIdUploading(false);
      markPending('identity');
      toast.success('ID submitted for review. Usually takes 24–48 hours.');
    } else if (id === 'selfie') {
      markPending('selfie');
      toast.success('Selfie submitted for review.');
    }
  };

  const trustScore = steps.reduce((sum, s) => sum + (s.status === 'verified' ? s.points : 0), 0);
  const maxScore = steps.reduce((sum, s) => sum + s.points, 0);

  const trustLevel =
    trustScore >= 80 ? 'High Trust'
    : trustScore >= 45 ? 'Partially Verified'
    : 'Unverified';

  const trustColor =
    trustScore >= 80 ? 'text-green-500'
    : trustScore >= 45 ? 'text-amber-500'
    : 'text-muted-foreground';

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-6" />
        <h2 className="text-xl font-bold mb-2">Verification Center</h2>
        <p className="text-muted-foreground text-[13px] mb-8 max-w-xs">
          Sign in to complete your verification and earn trusted seller status.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-md mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-2">Trust & Safety</p>
        <h1 className="text-3xl font-black tracking-tight">Verification Center</h1>
        <p className="text-[13px] text-muted-foreground mt-2 max-w-md">
          Complete verification steps to earn trust badges and unlock all Kerodex features.
          Verified sellers close deals faster and receive more inquiries.
        </p>
      </div>

      {/* ── Trust Score Panel ───────────────────────────────────────────── */}
      <div className="border border-border bg-card p-6 mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">Trust Score</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight">{trustScore}</span>
              <span className="text-[16px] text-muted-foreground">/ {maxScore}</span>
            </div>
            <div className={`text-[13px] font-bold mt-1 ${trustColor}`}>{trustLevel}</div>
          </div>

          <div className="text-right">
            <BadgeCheck className={`h-14 w-14 mx-auto ${trustScore >= 80 ? 'text-primary' : 'text-muted-foreground/30'}`} />
            {trustScore >= 80 && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary mt-1">Verified Seller</div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 bg-muted overflow-hidden rounded-full">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${(trustScore / maxScore) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{trustScore} points earned</span>
            <span>{maxScore - trustScore} more to max</span>
          </div>
        </div>

        {/* Badges unlocked */}
        <div className="flex flex-wrap gap-2 pt-1">
          {steps.filter((s) => s.status === 'verified').map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-primary/30 bg-primary/5 text-primary"
            >
              <CheckCircle2 className="h-3 w-3" />
              {s.title.replace(' Verification', '').replace(' Number', '')} Verified
            </span>
          ))}
          {steps.every((s) => s.status !== 'verified') && (
            <span className="text-[12px] text-muted-foreground">Complete steps below to earn badges.</span>
          )}
        </div>
      </div>

      {/* ── Verification Steps ──────────────────────────────────────────── */}
      <div className="space-y-3 mb-10">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] mb-4">Verification Steps</h2>
        {steps.map((step) => (
          <StepCard key={step.id} step={step} onStart={handleStart} />
        ))}
      </div>

      {/* ── Info Section ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 border border-border bg-card space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Privacy First</h3>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Your documents are encrypted, never shared with other users, and deleted after verification is complete.
          </p>
        </div>
        <div className="p-5 border border-border bg-card space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Why Verify?</h3>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Verified sellers get 2× more messages, higher listing visibility, and buyers report higher confidence.
          </p>
        </div>
      </div>

      {/* Phone modal */}
      {phoneModalOpen && (
        <PhoneVerifModal
          onClose={() => setPhoneModalOpen(false)}
          onDone={() => {
            markVerified('phone');
            setPhoneModalOpen(false);
          }}
        />
      )}

      {/* Loading overlay */}
      {idUploading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="bg-background border border-border p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-[13px] font-medium">Uploading document securely…</p>
          </div>
        </div>
      )}
    </div>
  );
}
