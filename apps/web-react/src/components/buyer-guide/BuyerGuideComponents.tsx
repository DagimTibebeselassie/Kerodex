import { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@blinkdotnew/ui';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Gauge,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  BuyerGuideListingMatch,
  BuyerGuideRecommendations,
} from '@/lib/api';
import {
  buyerGuideBodyStyleImage,
  useBuyerGuideImageFallback,
} from './buyerGuideBodyStyleImages';

export function BuyerGuideEntryCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`border border-border bg-card ${compact ? 'p-4' : 'p-5 md:p-6'} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5`}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 border border-border bg-background flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Not sure where to start?</p>
          <h2 className={`${compact ? 'text-[15px]' : 'text-lg md:text-xl'} font-black tracking-tight mt-1`}>Buyer Guide can walk you through it.</h2>
          <p className="text-[12px] md:text-[13px] text-muted-foreground leading-relaxed mt-1 max-w-xl">
            Narrow down the right vehicle, compare Kerodex listings, and continue through inspection, payment, title transfer, insurance, and registration.
          </p>
        </div>
      </div>
      <Link to="/buyer-guide" className="shrink-0">
        <Button className="w-full sm:w-auto h-10 px-5 text-[11px] font-bold uppercase tracking-widest">
          Start Buyer Guide <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </Link>
    </div>
  );
}

export function BuyerGuideProgress({
  current,
  total,
  stageLabel,
}: {
  current: number;
  total: number;
  stageLabel: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, total)) * 100)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span>{stageLabel}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted overflow-hidden rounded-full">
        <div className="h-full bg-foreground transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BuyerGuideQuestionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="max-w-3xl mx-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground mb-4">{eyebrow}</p>
      <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.02]">{title}</h1>
      {description && <p className="text-[14px] md:text-[15px] text-muted-foreground leading-relaxed mt-4 max-w-2xl">{description}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function BuyerGuideOptionChips({
  options,
  value,
  multiple = false,
  onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value: string | string[];
  multiple?: boolean;
  onChange: (next: string | string[]) => void;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!multiple) onChange(option.value);
              else onChange(active ? selected.filter((item) => item !== option.value) : [...selected, option.value]);
            }}
            className={`min-h-16 border p-4 text-left transition-colors ${active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:border-foreground/40'}`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-bold">{option.label}</span>
              {active && <Check className="h-4 w-4 shrink-0" />}
            </span>
            {option.description && (
              <span className={`block text-[11px] leading-relaxed mt-1 ${active ? 'text-background/70' : 'text-muted-foreground'}`}>
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BuyerGuideBudgetSlider({
  value,
  min,
  max,
  step = 500,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="border border-border bg-card p-5 md:p-6">
      <div className="flex items-end justify-between gap-4 mb-6">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-3xl md:text-4xl font-black tracking-tight">${value.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-foreground"
      />
      <div className="flex justify-between mt-3 text-[10px] text-muted-foreground">
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}+</span>
      </div>
    </div>
  );
}

const VEHICLE_PREFERENCES = [
  { value: 'sedan', label: 'Sedan', examples: 'Corolla, Civic, Mazda3', imagePosition: 'center 72%' },
  { value: 'SUV', label: 'SUV', examples: 'RAV4, CR-V, CX-5' },
  { value: 'truck', label: 'Truck', examples: 'F-150, Tacoma', imagePosition: 'center 56%' },
  { value: 'hatchback', label: 'Hatchback', examples: 'Prius, Civic Hatchback', imagePosition: 'center 72%' },
  { value: 'coupe', label: 'Coupe', examples: 'Civic Coupe, BRZ', imagePosition: 'center 72%' },
  { value: 'minivan', label: 'Minivan', examples: 'Odyssey, Sienna' },
  { value: 'electric', label: 'EV', examples: 'Model 3, electric crossover', imagePosition: 'center 72%' },
  { value: 'open', label: 'Open to options', examples: 'Show me what fits' },
];

export function BuyerGuideVehiclePreferenceCards({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {VEHICLE_PREFERENCES.map((item) => {
        const active = value.includes(item.value);
        const togglePreference = () => {
          onChange(active ? value.filter((entry) => entry !== item.value) : [...value, item.value]);
        };

        if (item.value === 'open') {
          return (
            <button
              key={item.value}
              type="button"
              onClick={togglePreference}
              className={`flex min-h-[148px] flex-col items-center justify-center border px-6 py-8 text-center transition-colors ${
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-foreground bg-background text-foreground hover:bg-foreground hover:text-background'
              }`}
            >
              <span className="text-[12px] font-bold uppercase tracking-widest">{item.label}</span>
              <span className="mt-2 text-[10px] opacity-70">
                {item.examples}
              </span>
              {active && <CheckCircle2 className="mt-4 h-4 w-4" />}
            </button>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            onClick={togglePreference}
            className={`group border p-3 text-left transition-colors ${active ? 'border-foreground bg-muted/40' : 'border-border hover:border-foreground/40'}`}
          >
            <div className="h-24 bg-muted overflow-hidden mb-3">
              <img
                src={buyerGuideBodyStyleImage(item.value)}
                alt={`${item.label} vehicle body style`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ objectPosition: item.imagePosition || 'center' }}
                loading="lazy"
                onError={(event) => useBuyerGuideImageFallback(event.currentTarget)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold">{item.label}</span>
              {active && <CheckCircle2 className="h-4 w-4" />}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{item.examples}</p>
          </button>
        );
      })}
    </div>
  );
}

export function BuyerGuideRecommendationSummary({ recommendations }: { recommendations: BuyerGuideRecommendations }) {
  return (
    <section className="space-y-8">
      <div className="border border-border bg-card p-5 md:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Based on what you told us</p>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-3">Your buyer profile</h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed mt-3">{recommendations.buyerProfileSummary}</p>
        <div className="flex flex-wrap gap-2 mt-5">
          {recommendations.recommendedCategories.map((category) => (
            <span key={category} className="border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{category}</span>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {recommendations.recommendedModels.map((item) => (
          <article key={`${item.make}-${item.model}`} className="border border-border bg-background p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.idealYears} · under {item.idealMileageMax.toLocaleString()} mi</p>
            <h3 className="text-lg font-black tracking-tight mt-2">{item.make} {item.model}</h3>
            <p className="text-[12px] text-muted-foreground leading-relaxed mt-2">{item.reason}</p>
            {item.tradeoffs.length > 0 && (
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-4 border-t border-border pt-3">
                <strong className="text-foreground">Tradeoff:</strong> {item.tradeoffs.join(' ')}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function listingImage(listing: any) {
  if (Array.isArray(listing.images)) return listing.images[0] || '';
  try {
    const parsed = JSON.parse(listing.images || '[]');
    return Array.isArray(parsed) ? parsed[0] || '' : '';
  } catch {
    return '';
  }
}

export function BuyerGuideListingMatches({
  matches,
  onSelect,
  onReject,
}: {
  matches: BuyerGuideListingMatch[];
  onSelect: (listingId: string) => void;
  onReject: (listingId: string) => void;
}) {
  if (!matches.length) {
    return (
      <div className="border border-border bg-card p-7 text-center">
        <h3 className="text-xl font-black">No strong Kerodex match is listed right now.</h3>
        <p className="text-[13px] text-muted-foreground mt-2">Your recommended vehicle types are still useful. Browse close matches or save your guide and return later.</p>
        <Link to="/cars"><Button variant="outline" className="mt-5">Browse all listings</Button></Link>
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {matches.map(({ listing, matchLevel, matchReason, concerns }) => {
        const image = listingImage(listing);
        return (
          <article key={listing.id} className="border border-border bg-background overflow-hidden">
            <div className="aspect-[16/9] bg-muted overflow-hidden">
              {image && <img src={image} alt={`${listing.year} ${listing.make} ${listing.model}`} className="w-full h-full object-cover" />}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{matchLevel} match</p>
                    {(listing.isDemo || listing.is_demo) && (
                      <span className="border border-foreground px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">Demo Listing</span>
                    )}
                  </div>
                  <h3 className="text-lg font-black tracking-tight mt-1">{listing.year} {listing.make} {listing.model}</h3>
                </div>
                <span className="text-lg font-black">${Number(listing.price || 0).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" />{Number(listing.mileage || 0).toLocaleString()} mi</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{listing.location}</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{listing.vehiclePresenceVerified ? 'Presence verified' : 'Verification pending'}</span>
              </div>
              <p className="text-[12px] leading-relaxed mt-4">{matchReason}</p>
              {(listing.isDemo || listing.is_demo) && (
                <p className="mt-3 text-[11px] font-medium text-muted-foreground">This listing is for demonstration/testing only.</p>
              )}
              {concerns.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-border pt-3">
                  {concerns.slice(0, 2).map((concern) => (
                    <p key={concern} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" /> {concern}
                    </p>
                  ))}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-2 mt-5">
                <Button onClick={() => onSelect(listing.id)} className="text-[10px] font-bold uppercase tracking-wider">Continue with this vehicle</Button>
                <Button onClick={() => onReject(listing.id)} variant="outline" className="text-[10px] font-bold uppercase tracking-wider">Not what I want</Button>
              </div>
              <Link to="/cars" search={{ q: `${listing.make} ${listing.model}` } as any} className="mt-3 inline-flex text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground">
                Show me more like this
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function BuyerGuideSafetyChecklist({ notes }: { notes: string[] }) {
  return (
    <section className="border border-border bg-muted/20 p-5 md:p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" />
        <h3 className="text-[12px] font-bold uppercase tracking-[0.16em]">Safety checkpoints</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-5">
        {notes.map((note) => (
          <p key={note} className="flex gap-2 text-[12px] text-muted-foreground leading-relaxed">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {note}
          </p>
        ))}
      </div>
    </section>
  );
}

export function BuyerGuideResumeBanner({
  onResume,
  onRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex gap-3">
        <Clock3 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-bold">Resume your Buyer Guide?</p>
          <p className="text-[11px] text-muted-foreground mt-1">Your latest answers and recommendations are saved.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onResume} className="h-9 text-[10px] font-bold uppercase tracking-wider">Resume</Button>
        <Button onClick={onRestart} variant="outline" className="h-9 text-[10px] font-bold uppercase tracking-wider">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restart
        </Button>
      </div>
    </div>
  );
}
