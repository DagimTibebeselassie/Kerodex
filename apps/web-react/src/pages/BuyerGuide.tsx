import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, toast } from '@blinkdotnew/ui';
import { ArrowLeft, CheckCircle2, Circle, Loader2, MessageSquare, ShieldCheck, XCircle } from 'lucide-react';
import { BUYER_GUIDE_DISCLAIMER, BUYER_GUIDE_STEPS } from '@/data/buyer-guide-steps';
import { getBuyerGuide, startConversation, toVehicle, updateBuyerGuide } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Vehicle } from '@/types';

function formatMoney(value?: number) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function BuyerGuidePage() {
  const params = useParams({ strict: false }) as { guideId?: string };
  const guideId = params.guideId || '';
  const { user, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteDraft, setNoteDraft] = useState('');

  const { data: guide, isLoading, error } = useQuery({
    queryKey: ['buyer-guide', guideId, user?.id],
    queryFn: () => getBuyerGuide(guideId),
    enabled: !!user && !!guideId,
  });

  const listing = guide?.listing && guide.listing.id ? toVehicle(guide.listing) as Vehicle : null;
  const completed = new Set(guide?.completedSteps || guide?.completed_steps || []);
  const currentStepId = guide?.currentStep || guide?.current_step || BUYER_GUIDE_STEPS[0].id;
  const currentStep = BUYER_GUIDE_STEPS.find((step) => step.id === currentStepId) || BUYER_GUIDE_STEPS[0];
  const currentIndex = BUYER_GUIDE_STEPS.findIndex((step) => step.id === currentStep.id);
  const progressPct = Math.round((completed.size / BUYER_GUIDE_STEPS.length) * 100);
  const notes = guide?.notes || {};

  useEffect(() => {
    setNoteDraft(String(notes[currentStep.id] || ''));
  }, [currentStep.id, guide?.id]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateBuyerGuide(guideId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['buyer-guide', guideId, user?.id], updated);
    },
    onError: (err: any) => toast.error(err?.message || 'Unable to save buyer guide.'),
  });

  const setCurrentStep = (stepId: string) => {
    saveMutation.mutate({ currentStep: stepId });
  };

  const toggleStep = (stepId: string) => {
    const next = new Set(completed);
    next.has(stepId) ? next.delete(stepId) : next.add(stepId);
    const nextCurrent = next.has(currentStep.id)
      ? (BUYER_GUIDE_STEPS.find((step) => !next.has(step.id))?.id || currentStep.id)
      : currentStep.id;
    saveMutation.mutate({
      completedSteps: Array.from(next),
      currentStep: nextCurrent,
      status: next.size === BUYER_GUIDE_STEPS.length ? 'completed' : 'active',
    });
  };

  const saveNote = () => {
    saveMutation.mutate({
      notes: {
        ...notes,
        [currentStep.id]: noteDraft.trim(),
      },
    });
    toast.success('Guide note saved.');
  };

  const messageSeller = async () => {
    if (!user || !listing) {
      login();
      return;
    }
    if (listing.isDemo) {
      toast.success('Demo listings are for testing only. Seller contact is disabled.');
      return;
    }
    try {
      await startConversation(listing.id);
      navigate({ to: '/messages' });
    } catch (err: any) {
      toast.error(err?.message || 'Unable to open message thread.');
    }
  };

  if (authLoading) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <ShieldCheck className="h-10 w-10 mx-auto mb-5 text-muted-foreground" />
        <h1 className="text-2xl font-black tracking-tight mb-3">Sign in to continue your buyer guide.</h1>
        <p className="text-[13px] text-muted-foreground mb-7">Buyer guides are saved to your Kerodex account so you can resume them later.</p>
        <Button onClick={login} className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest">Sign In</Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error || !guide || !listing) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <XCircle className="h-10 w-10 mx-auto mb-5 text-muted-foreground" />
        <h1 className="text-2xl font-black tracking-tight mb-3">Buyer guide unavailable.</h1>
        <p className="text-[13px] text-muted-foreground mb-7">This guide may not exist, or it may belong to another account.</p>
        <Link to="/dashboard"><Button variant="outline" className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const vehicleImage = listing.images?.[0] || '';
  const sellerName = String((guide.seller as any)?.name || listing.seller?.name || 'Kerodex seller');
  const badges = [
    listing.vehiclePresenceVerified ? 'Vehicle Presence Verified' : '',
    listing.marketCheckVin ? 'VIN decoded' : '',
    listing.titleStatus || '',
  ].filter(Boolean).slice(0, 3);

  return (
    <div className="animate-fade-in px-4 md:px-6 py-8 md:py-12 max-w-screen-xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground mb-5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">Buyer Purchase Guide</p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none">Private-party purchase checklist.</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/vehicle/$id" params={{ id: listing.id }}>
            <Button variant="outline" className="h-10 px-4 text-[11px] font-bold uppercase tracking-widest">Back to Listing</Button>
          </Link>
          <Button onClick={messageSeller} className="h-10 px-4 text-[11px] font-bold uppercase tracking-widest">
            <MessageSquare className="h-4 w-4 mr-2" /> {listing.isDemo ? 'Try Demo Messages' : 'Message Seller'}
          </Button>
        </div>
      </div>

      <section className="border border-border bg-background p-4 md:p-5">
        {listing.isDemo && (
          <div className="mb-4 border border-amber-300 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
            <strong>Demo Listing:</strong> this vehicle is not actually for sale. Messaging opens a sandboxed conversation with an automated demo seller.
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="h-36 sm:h-28 sm:w-44 bg-muted overflow-hidden shrink-0">
            {vehicleImage ? <img src={vehicleImage} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black tracking-tight">{listing.year} {listing.make} {listing.model}</h2>
            <p className="text-[13px] text-muted-foreground mt-1">{formatMoney(listing.price)} · {listing.location} · Seller: {sellerName}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {badges.map((badge) => (
                <span key={badge} className="border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{badge}</span>
              ))}
            </div>
          </div>
          <div className="sm:w-56">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{completed.size} of {BUYER_GUIDE_STEPS.length} complete</div>
            <div className="h-2 bg-muted overflow-hidden">
              <div className="h-full bg-foreground transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">{progressPct}% complete</div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <aside className="border border-border bg-background">
          {BUYER_GUIDE_STEPS.map((step, index) => {
            const done = completed.has(step.id);
            const active = step.id === currentStep.id;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-start gap-3 px-4 py-4 text-left border-b border-border last:border-b-0 transition-colors ${active ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
              >
                {done ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" /> : <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Step {index + 1}</span>
                  <span className="block text-[13px] font-bold">{step.title}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="border border-border bg-background p-5 md:p-7 space-y-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Step {currentIndex + 1}</p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">{currentStep.title}</h2>
              <p className="text-[14px] text-muted-foreground mt-3 leading-relaxed">{currentStep.short}</p>
            </div>
            <Button
              variant={completed.has(currentStep.id) ? 'outline' : 'default'}
              onClick={() => toggleStep(currentStep.id)}
              className="h-10 px-4 text-[11px] font-bold uppercase tracking-widest shrink-0"
            >
              {completed.has(currentStep.id) ? 'Mark Incomplete' : 'Mark Complete'}
            </Button>
          </div>

          <div className="space-y-3">
            {currentStep.checklist.map((item) => (
              <div key={item} className="flex gap-3 text-[13px] leading-relaxed">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {currentStep.warning && (
            <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">
              {currentStep.warning}
            </div>
          )}

          {currentStep.stateSpecificPlaceholder && (
            <div className="border border-border bg-muted/20 p-4 text-[12px] leading-relaxed text-muted-foreground">
              {currentStep.stateSpecificPlaceholder}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Private note for this step</label>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              rows={4}
              placeholder="Add a reminder, question for the seller, inspection note, or paperwork detail..."
              className="w-full resize-none border border-border bg-background px-3 py-3 text-[13px] outline-none focus:border-primary"
            />
            <Button onClick={saveNote} variant="outline" className="h-9 px-4 text-[11px] font-bold uppercase tracking-widest" disabled={saveMutation.isPending}>
              Save Note
            </Button>
          </div>

          <div className="border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
            {BUYER_GUIDE_DISCLAIMER}
          </div>
        </main>
      </div>
    </div>
  );
}
