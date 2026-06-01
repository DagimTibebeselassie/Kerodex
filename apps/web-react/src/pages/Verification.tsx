import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { submitVerificationRequest } from '@/lib/api';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  Shield, BadgeCheck, Phone, Mail, FileText, Camera,
  CheckCircle2, Clock, ChevronRight, Lock, AlertTriangle, Loader2, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type VerifStatus = 'not_started' | 'in_progress' | 'pending' | 'verified';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: VerifStatus;
  points: number;
  required: boolean;
}

// ── Phone Modal ────────────────────────────────────────────────────────────
function PhoneModal({
  onClose,
  onDone,
}: { onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const sendCode = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) { setErr('Enter a valid US phone number'); return; }
    setErr(''); setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setStep('code');
    toast.success('Code sent! (demo code: 123456)');
  };

  const verify = async () => {
    if (code.length !== 6) { setErr('Enter the 6-digit code'); return; }
    if (code !== '123456') { setErr('Invalid code. Demo: use 123456'); return; }
    setErr(''); setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border w-full max-w-sm p-6 space-y-5 rounded-lg shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Phone Verification</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {step === 'phone' ? (
          <>
            <p className="text-[13px] text-muted-foreground">Enter your US mobile number to receive a verification code.</p>
            <Input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErr(''); }}
              className="h-11 text-[13px]"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
            {err && <p className="text-[11px] text-destructive">{err}</p>}
            <Button onClick={sendCode} disabled={loading} className="w-full h-11 text-[12px] font-bold uppercase tracking-widest">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Verification Code'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">Enter the 6-digit code sent to <strong>{phone}</strong>.</p>
            <Input
              type="text" inputMode="numeric" maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(''); }}
              className="h-11 text-[13px] font-mono tracking-[0.4em] text-center"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
            {err && <p className="text-[11px] text-destructive">{err}</p>}
            <Button onClick={verify} disabled={loading || code.length !== 6} className="w-full h-11 text-[12px] font-bold uppercase tracking-widest">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Code'}
            </Button>
            <button onClick={() => { setStep('phone'); setCode(''); setErr(''); }}
              className="w-full text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2">
              Use a different number
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── ID Upload Modal ────────────────────────────────────────────────────────
function IdUploadModal({
  onClose,
  onDone,
}: { onClose: () => void; onDone: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    // Simulate upload & review submission
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    onDone();
    toast.success('ID submitted for review (usually 24–48h)');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border w-full max-w-sm p-6 space-y-5 rounded-lg shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Upload Government ID</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[13px] text-muted-foreground">Upload a photo of your driver's license, passport, or state ID.</p>

        {preview ? (
          <div className="relative">
            <img src={preview} alt="ID preview" className="w-full h-40 object-cover rounded-md border border-border" />
            <button onClick={() => { setFile(null); setPreview(''); }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className={`h-32 border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground font-medium">Click or drag & drop your ID</p>
            <p className="text-[11px] text-muted-foreground">JPG, PNG, or PDF</p>
            <input ref={inputRef} type="file" className="hidden" accept="image/*,.pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-[11px] text-muted-foreground">Encrypted upload. Document deleted after verification.</p>
        </div>

        <Button onClick={submit} disabled={!file || loading} className="w-full h-11 text-[12px] font-bold uppercase tracking-widest">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : 'Submit for Review'}
        </Button>
      </div>
    </div>
  );
}

// ── Selfie Modal ────────────────────────────────────────────────────────────
function SelfieModal({
  onClose,
  onDone,
}: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Please upload an image'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    onDone();
    toast.success('Selfie submitted for review');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border w-full max-w-sm p-6 space-y-5 rounded-lg shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Selfie Verification</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Take a clear selfie showing your face. We'll match it to your ID to complete verification.
        </p>

        <ul className="space-y-1.5 text-[12px] text-muted-foreground">
          {['Face clearly visible', 'Good lighting — no shadows', 'No sunglasses or hats'].map((t) => (
            <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />{t}</li>
          ))}
        </ul>

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Selfie" className="w-full h-40 object-cover rounded-md border border-border" />
            <button onClick={() => { setFile(null); setPreview(''); }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-destructive hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Camera className="h-8 w-8 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground font-medium">Upload selfie or take photo</p>
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden" accept="image/*" capture="user"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        <Button onClick={submit} disabled={!file || loading} className="w-full h-11 text-[12px] font-bold uppercase tracking-widest">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : 'Submit Selfie'}
        </Button>
      </div>
    </div>
  );
}

// ── Step Card ──────────────────────────────────────────────────────────────
function StepCard({ step, onStart }: { step: Step; onStart: (id: string) => void }) {
  const statusMap = {
    not_started: { label: 'Not Started', cls: 'border-border text-muted-foreground bg-transparent', canStart: true },
    in_progress: { label: 'In Progress', cls: 'border-primary/30 bg-primary/5 text-primary', canStart: false },
    pending:     { label: 'In Review',   cls: 'border-amber-400/30 bg-amber-400/5 text-amber-500', canStart: false },
    verified:    { label: 'Verified',    cls: 'border-green-500/30 bg-green-500/5 text-green-500', canStart: false },
  };
  const s = statusMap[step.status];

  return (
    <div className={`p-5 border rounded-lg transition-colors ${
      step.status === 'verified' ? 'border-green-500/20 bg-card' : 'border-border bg-card hover:border-primary/30'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
          step.status === 'verified' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
        }`}>
          {step.status === 'verified' ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h3 className="text-[14px] font-bold">{step.title}</h3>
            {step.required && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 rounded">
                Required
              </span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${s.cls}`}>
              {s.label}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground mb-2">{step.description}</p>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-primary" />
            <span className="text-[11px] text-primary font-bold">+{step.points} trust points</span>
          </div>
        </div>

        {s.canStart && (
          <Button onClick={() => onStart(step.id)} variant="outline"
            className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider shrink-0">
            Start <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
        {step.status === 'pending' && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-500 shrink-0">
            <Clock className="h-3.5 w-3.5" />Under review
          </div>
        )}
        {step.status === 'verified' && (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function VerificationPage() {
  const { user, login, isLoading: authLoading } = useAuth();

  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'email', title: 'Email Verification',
      description: 'Confirm your email address before publishing trusted listings.',
      icon: <Mail className="h-5 w-5" />,
      status: 'not_started', points: 10, required: true,
    },
    {
      id: 'phone', title: 'Phone Verification',
      description: 'Verify your mobile number via SMS to unlock messaging.',
      icon: <Phone className="h-5 w-5" />,
      status: 'not_started', points: 20, required: true,
    },
    {
      id: 'id', title: 'Government ID',
      description: 'Upload a driver\'s license, passport, or state ID.',
      icon: <FileText className="h-5 w-5" />,
      status: 'not_started', points: 35, required: false,
    },
    {
      id: 'selfie', title: 'Selfie Match',
      description: 'Take a selfie to match against your government ID.',
      icon: <Camera className="h-5 w-5" />,
      status: 'not_started', points: 25, required: false,
    },
  ]);

  const [modal, setModal] = useState<string | null>(null);

  useEffect(() => {
    setSteps((prev) => prev.map((step) => {
      if (step.id === 'email') return { ...step, status: user?.emailVerified ? 'verified' : 'not_started' };
      if (step.id === 'phone') return { ...step, status: user?.phoneVerified ? 'verified' : step.status };
      if (step.id === 'id') return { ...step, status: user?.identityVerified ? 'verified' : step.status };
      if (step.id === 'selfie') return { ...step, status: user?.selfieVerified ? 'verified' : step.status };
      return step;
    }));
  }, [user?.emailVerified, user?.phoneVerified, user?.identityVerified, user?.selfieVerified]);

  const setStatus = (id: string, status: VerifStatus) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  };

  const handleStart = (id: string) => {
    if (id === 'email' && user?.emailVerified) {
      setStatus(id, 'verified');
      return;
    }
    setStatus(id, 'in_progress');
    setModal(id);
  };

  const handleDone = async (id: string, finalStatus: VerifStatus) => {
    setModal(null);
    setStatus(id, finalStatus);
    if (id === 'id' || id === 'selfie') {
      try {
        await submitVerificationRequest(id === 'id' ? 'identity' : 'selfie');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to send verification to admin review.');
      }
    }
  };

  const handleModalClose = (id: string) => {
    setModal(null);
    // Revert in_progress → not_started if user closed without completing
    setSteps((prev) =>
      prev.map((s) => s.id === id && s.status === 'in_progress' ? { ...s, status: 'not_started' } : s)
    );
  };

  const score = steps.reduce((sum, s) => sum + (s.status === 'verified' ? s.points : 0), 0);
  const max   = steps.reduce((sum, s) => sum + s.points, 0);
  const level = score >= 80 ? 'High Trust' : score >= 30 ? 'Partially Verified' : 'Unverified';
  const levelColor = score >= 80 ? 'text-green-500' : score >= 30 ? 'text-amber-500' : 'text-muted-foreground';

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
          Sign in to complete verification and earn trusted seller badges.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-md mx-auto">
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-2">Trust & Safety</p>
        <h1 className="text-3xl font-black tracking-tight">Verification Center</h1>
        <p className="text-[13px] text-muted-foreground mt-2">
          Verified sellers get 2× more messages and unlock all Kerodex features.
        </p>
      </div>

      {/* Score card */}
      <div className="border border-border bg-card p-6 rounded-lg mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">Trust Score</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black tracking-tight">{score}</span>
              <span className="text-[16px] text-muted-foreground">/ {max}</span>
            </div>
            <div className={`text-[13px] font-bold mt-1 ${levelColor}`}>{level}</div>
          </div>
          <BadgeCheck className={`h-14 w-14 ${score >= 80 ? 'text-primary' : 'text-muted-foreground/20'}`} />
        </div>

        <div className="space-y-1.5">
          <div className="h-2.5 bg-muted overflow-hidden rounded-full">
            <div className="h-full bg-primary transition-all duration-700 rounded-full"
              style={{ width: `${(score / max) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{score} pts earned</span>
            <span>{max - score} more to max</span>
          </div>
        </div>

        {/* Earned badges */}
        <div className="flex flex-wrap gap-2">
          {steps.filter((s) => s.status === 'verified').map((s) => (
            <span key={s.id}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-primary/30 bg-primary/5 text-primary rounded">
              <CheckCircle2 className="h-3 w-3" />
              {s.title.replace(' Verification', '').replace(' Match', '')} Verified
            </span>
          ))}
          {steps.every((s) => s.status !== 'verified') && (
            <span className="text-[12px] text-muted-foreground">Complete steps below to earn badges.</span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        <h2 className="text-[12px] font-black uppercase tracking-[0.18em] mb-4">Verification Steps</h2>
        {steps.map((step) => (
          <StepCard key={step.id} step={step} onStart={handleStart} />
        ))}
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 border border-border bg-card rounded-lg space-y-1.5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em]">Privacy First</h3>
          </div>
          <p className="text-[12px] text-muted-foreground">Documents are encrypted and deleted once verification completes.</p>
        </div>
        <div className="p-4 border border-border bg-card rounded-lg space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em]">Why Verify?</h3>
          </div>
          <p className="text-[12px] text-muted-foreground">Verified sellers close deals 40% faster and buyers trust them more.</p>
        </div>
      </div>

      {/* Modals */}
      {modal === 'phone' && (
        <PhoneModal
          onClose={() => handleModalClose('phone')}
          onDone={() => handleDone('phone', 'verified')}
        />
      )}
      {modal === 'id' && (
        <IdUploadModal
          onClose={() => handleModalClose('id')}
          onDone={() => handleDone('id', 'pending')}
        />
      )}
      {modal === 'selfie' && (
        <SelfieModal
          onClose={() => handleModalClose('selfie')}
          onDone={() => handleDone('selfie', 'pending')}
        />
      )}
    </div>
  );
}
