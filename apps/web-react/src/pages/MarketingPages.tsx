import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui';
import { ArrowRight, BadgeCheck, Car, Mail, MessageSquare, Search, ShieldCheck } from 'lucide-react';

export function SignInPage() {
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
            <p className="text-[13px] text-muted-foreground">founder@kerodexofficial.com</p>
          </div>
        </div>
        <a href="mailto:founder@kerodexofficial.com">
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
