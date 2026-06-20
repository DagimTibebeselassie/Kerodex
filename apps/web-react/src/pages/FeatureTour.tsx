import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button, toast } from '@blinkdotnew/ui';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Car,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { completeFeatureTour } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type TourSlide = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  secondary?: string;
};

const slides: TourSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'Welcome',
    title: 'Welcome to Kerodex',
    text: 'Kerodex helps buyers and sellers complete private-party vehicle sales with more confidence.',
    secondary: 'We built tools that help you verify listings, understand seller verification, and navigate the buying process more safely.',
  },
  {
    id: 'buyer-guide',
    eyebrow: 'Buyer Guide',
    title: 'Guided buying from listing to ownership',
    text: 'When you find a car you like, Kerodex can guide you step-by-step from reviewing the listing through paperwork reminders and ownership transfer guidance.',
    secondary: 'The Buyer Guide lives on each listing so you can start it right when you are ready to move forward.',
  },
  {
    id: 'presence',
    eyebrow: 'Verification',
    title: 'Vehicle Presence Verified',
    text: 'Look for the Vehicle Presence Verified badge.',
    secondary: 'This means the seller completed a photo challenge designed to show that the vehicle is physically present.',
  },
  {
    id: 'messaging',
    eyebrow: 'Safety',
    title: 'Keep conversations inside Kerodex',
    text: 'Use Kerodex messaging when discussing vehicles so conversations stay easier to review and report.',
    secondary: 'Be careful with gift cards, crypto, wire transfer pressure, off-platform messages, and payment before seeing the vehicle.',
  },
  {
    id: 'badges',
    eyebrow: 'Trust Signals',
    title: 'Understand verification badges',
    text: 'Verification badges help you understand what checks a seller or listing has completed.',
    secondary: 'Each badge points to a specific signal. No badge should replace your own inspection, title review, or safe payment judgment.',
  },
  {
    id: 'ready',
    eyebrow: 'Ready',
    title: "You're ready to explore",
    text: 'Browse listings, save favorites, message sellers, and start a Buyer Guide whenever you are ready.',
  },
];

function WelcomeVisual() {
  return (
    <div className="relative overflow-hidden border border-border bg-card p-6 min-h-[280px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="h-12 w-12 border border-border bg-background flex items-center justify-center">
          <Car className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Private-party</span>
      </div>
      <div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {['Verify', 'Message', 'Guide'].map((item) => (
            <div key={item} className="border border-border bg-background p-3">
              <div className="h-1.5 w-10 bg-foreground mb-3" />
              <div className="text-[11px] font-bold">{item}</div>
            </div>
          ))}
        </div>
        <p className="text-3xl font-black tracking-tight leading-none">More for sellers. Less for buyers.</p>
      </div>
    </div>
  );
}

function BuyerGuideVisual() {
  return (
    <div className="relative border border-border bg-card p-5 md:p-6 overflow-hidden">
      <div className="absolute right-5 top-5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Listing panel</div>
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Market Value</p>
          <p className="text-3xl font-black tracking-tight mt-1">$18,900</p>
        </div>
        <div className="flex items-center justify-between border border-border bg-background p-3">
          <span className="text-[12px] font-bold">Seller Verified</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        </div>
        <button type="button" className="w-full border border-border bg-background px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
          Message Seller
        </button>
        <div className="relative">
          <div className="absolute -inset-2 border border-primary/60 bg-primary/5 animate-pulse" />
          <button type="button" className="relative w-full bg-foreground text-background px-4 py-3 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            Start Buyer Guide <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute -right-2 -top-14 max-w-[190px] border border-border bg-background px-3 py-2 text-[11px] font-bold shadow-lg">
            Start here when you are ready to buy.
          </div>
        </div>
      </div>
    </div>
  );
}

function PresenceVisual() {
  return (
    <div className="border border-border bg-card p-6 min-h-[280px] flex flex-col justify-center">
      <div className="mx-auto border border-border bg-background p-5 max-w-xs text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="inline-flex items-center gap-2 border border-border px-3 py-2 text-[11px] font-black uppercase tracking-wider">
          <CheckCircle2 className="h-4 w-4" /> Vehicle Presence Verified
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          A listing-specific VIN and code photo was submitted for this vehicle.
        </p>
      </div>
    </div>
  );
}

function MessagingVisual() {
  const warnings = ['Gift cards', 'Crypto requests', 'Wire pressure', 'Move off app'];
  return (
    <div className="border border-border bg-card p-5 min-h-[280px]">
      <div className="space-y-3">
        <div className="max-w-[82%] border border-border bg-background p-3 text-[12px]">Can we meet Saturday at a public location?</div>
        <div className="ml-auto max-w-[82%] bg-foreground text-background p-3 text-[12px]">Yes. Please keep title and VIN photos ready.</div>
        <div className="border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <TriangleAlert className="h-4 w-4" /> Safety reminders
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {warnings.map((item) => (
              <span key={item} className="border border-amber-500/20 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgesVisual() {
  const badges = [
    ['Phone Verified', 'Seller added and verified a phone number.'],
    ['Identity Verification', 'Coming soon through Persona; no identity badges are issued during beta.'],
    ['Vehicle Presence Verified', 'Seller completed the VIN and code photo challenge.'],
  ];
  return (
    <div className="border border-border bg-card p-5 min-h-[280px] grid gap-3 content-center">
      {badges.map(([title, body]) => (
        <div key={title} className="border border-border bg-background p-4 flex gap-3">
          <BadgeCheck className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-black uppercase tracking-wider">{title}</div>
            <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadyVisual() {
  return (
    <div className="border border-border bg-card p-6 min-h-[280px] flex flex-col justify-center">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Browse', Car],
          ['Save', CheckCircle2],
          ['Message', MessageSquare],
          ['Guide', Sparkles],
        ].map(([label, Icon]) => {
          const TourIcon = Icon as typeof Car;
          return (
            <div key={String(label)} className="border border-border bg-background p-4">
              <TourIcon className="h-5 w-5 mb-6" />
              <div className="text-[12px] font-black uppercase tracking-wider">{String(label)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TourVisual({ id }: { id: string }) {
  if (id === 'buyer-guide') return <BuyerGuideVisual />;
  if (id === 'presence') return <PresenceVisual />;
  if (id === 'messaging') return <MessagingVisual />;
  if (id === 'badges') return <BadgesVisual />;
  if (id === 'ready') return <ReadyVisual />;
  return <WelcomeVisual />;
}

export function FeatureTourPage() {
  const { user, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const progress = useMemo(() => `${index + 1} of ${slides.length}`, [index]);

  const finish = async () => {
    if (!user) {
      login();
      return;
    }
    setSaving(true);
    try {
      await completeFeatureTour();
      navigate({ to: '/cars' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save guide progress.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <Sparkles className="h-10 w-10 mx-auto mb-5 text-muted-foreground" />
        <h1 className="text-2xl font-black tracking-tight mb-3">Sign in to view the Kerodex guide.</h1>
        <p className="text-[13px] text-muted-foreground mb-7">The guide is saved to your account so it only appears automatically once.</p>
        <Button onClick={login} className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest">Sign In</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 md:px-6 py-8 md:py-12 flex items-center justify-center animate-fade-in">
      <section className="w-full max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Kerodex Guide</p>
            <p className="text-[12px] text-muted-foreground mt-1">Slide {progress}</p>
          </div>
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        </div>

        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-5 md:gap-8 items-stretch">
          <div className="border border-border bg-background p-6 md:p-8 flex flex-col min-h-[420px]">
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-4">{slide.eyebrow}</p>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[0.95]">{slide.title}</h1>
              <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{slide.text}</p>
              {slide.secondary && <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{slide.secondary}</p>}
            </div>

            <div className="mt-auto">
              <div className="flex gap-2 mb-8">
                {slides.map((item, dotIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(dotIndex)}
                    aria-label={`Go to slide ${dotIndex + 1}`}
                    className={`h-1.5 transition-all ${dotIndex === index ? 'w-8 bg-foreground' : 'w-3 bg-muted'}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  disabled={index === 0 || saving}
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  className="h-10 px-4 text-[11px] font-bold uppercase tracking-widest"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                {isLast ? (
                  <Button
                    onClick={finish}
                    disabled={saving}
                    className="h-10 px-5 text-[11px] font-bold uppercase tracking-widest"
                  >
                    {saving ? 'Saving...' : 'Browse Cars'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
                    disabled={saving}
                    className="h-10 px-5 text-[11px] font-bold uppercase tracking-widest"
                  >
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="transition-all duration-300 ease-out">
            <TourVisual id={slide.id} />
          </div>
        </div>
      </section>
    </div>
  );
}
