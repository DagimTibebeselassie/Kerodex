import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@blinkdotnew/ui';
import { AlertTriangle, ArrowRight, BadgeCheck, Ban, Building2, Car, HelpCircle, Mail, MessageSquare, Search, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function SignInPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate({ to: '/' });
    }
  }, [isLoading, navigate, user]);

  const openAuth = (tab: 'login' | 'signup') => {
    window.dispatchEvent(new CustomEvent('kerodex:auth-required', { detail: { tab } }));
  };

  return (
    <div className="animate-fade-in px-4 md:px-6 py-16 max-w-4xl mx-auto">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">Kerodex account</p>
      <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">Sign in to Kerodex.</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl mb-8">
        Save vehicles, message sellers, manage listings, and continue seller verification from one account.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => openAuth('login')} className="h-11 px-6 text-[12px] font-bold uppercase tracking-wider">
          Sign In
        </Button>
        <Button onClick={() => openAuth('signup')} variant="outline" className="h-11 px-6 text-[12px] font-bold uppercase tracking-wider">
          Create Account
        </Button>
      </div>
    </div>
  );
}

export function HowItWorksPage() {
  const steps = [
    {
      icon: <Search className="h-4 w-4" />,
      title: 'Browse private-party cars',
      body: 'Search by make, model, location, price, mileage, title status, and verification signals.',
    },
    {
      icon: <BadgeCheck className="h-4 w-4" />,
      title: 'Review trust signals',
      body: 'Kerodex shows listing details, seller information, market guidance, and verification status where available.',
    },
    {
      icon: <MessageSquare className="h-4 w-4" />,
      title: 'Message safely',
      body: 'Keep buyer and seller communication inside Kerodex so suspicious activity can be reported and reviewed.',
    },
    {
      icon: <Car className="h-4 w-4" />,
      title: 'List with less friction',
      body: 'Sellers can use VIN autofill, photo uploads, vehicle presence checks, maintenance records, and pricing tools.',
    },
  ];

  return (
    <div className="animate-fade-in px-4 md:px-6 py-16 max-w-5xl mx-auto">
      <section className="max-w-3xl mb-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">How it works</p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">A cleaner way to buy and sell private-party cars.</h1>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          Kerodex is designed to make private car sales easier to discover, easier to understand, and easier to trust.
        </p>
      </section>
      <div className="grid sm:grid-cols-2 gap-px border border-border bg-border">
        {steps.map((step) => (
          <section key={step.title} className="bg-background p-6">
            <div className="flex items-center gap-2 mb-3">
              {step.icon}
              <h2 className="text-[13px] font-bold uppercase tracking-widest">{step.title}</h2>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{step.body}</p>
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link to="/cars">
          <Button className="h-11 px-6 text-[12px] font-bold uppercase tracking-wider">
            Browse Cars <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link to="/sell">
          <Button variant="outline" className="h-11 px-6 text-[12px] font-bold uppercase tracking-wider">
            Sell Your Car
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="animate-fade-in px-4 md:px-6 py-16 max-w-4xl mx-auto">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">Contact Kerodex</p>
      <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">Reach the Kerodex team.</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl mb-10">
        For marketplace questions, seller support, safety concerns, or partnership conversations, contact Kerodex directly.
      </p>
      <div className="border border-border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 border border-border flex items-center justify-center">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-widest">Email</h2>
            <p className="text-[13px] text-muted-foreground">Kerodex Support</p>
          </div>
        </div>
        <a href="mailto:founder@kerodexofficial.com" aria-label="Email Kerodex Support">
          <Button className="h-10 px-5 text-[12px] font-bold uppercase tracking-wider">Email Kerodex</Button>
        </a>
      </div>
      <div className="mt-8 border border-border bg-muted/30 p-5 flex gap-3">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          If you are reporting a suspicious listing or message, include the listing URL, username, and a short explanation so the review is easier to trace.
        </p>
      </div>
    </div>
  );
}

export function SupportPage() {
  const topics = [
    ['Account access', 'Sign-in, email verification, saved cars, and profile questions.'],
    ['Listing help', 'VIN autofill, photos, vehicle presence verification, pricing, and edits.'],
    ['Safety review', 'Suspicious listings, payment pressure, title concerns, or unsafe messages.'],
  ];
  return (
    <div className="animate-fade-in px-4 md:px-6 py-16 max-w-5xl mx-auto">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">Kerodex support</p>
      <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">Get help with Kerodex.</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl mb-10">
        Kerodex support is focused on account access, listing quality, buyer-seller communication, and marketplace safety.
      </p>
      <div className="grid md:grid-cols-3 gap-px border border-border bg-border mb-8">
        {topics.map(([title, body]) => (
          <section key={title} className="bg-background p-6">
            <HelpCircle className="h-4 w-4 mb-4" />
            <h2 className="text-[13px] font-bold uppercase tracking-widest mb-2">{title}</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
      <a href="mailto:founder@kerodexofficial.com" aria-label="Email Kerodex Support">
        <Button className="h-11 px-6 text-[12px] font-bold uppercase tracking-wider">Email Support</Button>
      </a>
    </div>
  );
}

export function ProhibitedListingsPage() {
  const prohibited = [
    'Vehicles the seller does not own or is not authorized to list.',
    'Copied listings, stolen photos, screenshots, or listings created from another marketplace without permission.',
    'Vehicles with intentionally hidden VINs, undisclosed title branding, or knowingly inaccurate mileage.',
    'Listings requesting deposits, gift cards, cryptocurrency, wire transfers, or off-platform payment pressure.',
    'Parts-only, non-vehicle, illegal, stolen, or unsafe items represented as normal vehicle listings.',
  ];
  return (
    <div className="animate-fade-in px-4 md:px-6 py-16 max-w-4xl mx-auto">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">Marketplace rules</p>
      <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">Prohibited listings.</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl mb-10">
        Kerodex is for private-party vehicle listings that are accurate, traceable, and safe for buyers to review.
      </p>
      <div className="space-y-px border border-border bg-border">
        {prohibited.map((item) => (
          <div key={item} className="bg-background p-5 flex gap-3">
            <Ban className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-5 flex gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p className="text-[13px] text-amber-800 dark:text-amber-300 leading-relaxed">
          Kerodex may hide, review, or remove listings that appear misleading, unsafe, duplicated, or inconsistent with marketplace rules.
        </p>
      </div>
    </div>
  );
}

export function DealerPolicyPage() {
  return (
    <div className="animate-fade-in px-4 md:px-6 py-16 max-w-4xl mx-auto">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">Dealer policy</p>
      <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">Kerodex is built for private sellers.</h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl mb-10">
        Kerodex’s launch focus is owner-to-buyer listings. Dealer, broker, curbstoning, and commercial inventory should not be posted as private-party listings.
      </p>
      <div className="border border-border bg-background p-6 space-y-5">
        <div className="flex gap-3">
          <Building2 className="h-4 w-4 shrink-0 mt-1" />
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-widest mb-2">Commercial inventory</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Listings from dealerships, brokers, exporters, flippers operating as businesses, or repeated commercial sellers may be reviewed or removed.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-1" />
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-widest mb-2">Why this matters</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Kerodex is trying to keep pricing and communication closer to real vehicle owners, with fewer dealer fees and less inventory noise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
