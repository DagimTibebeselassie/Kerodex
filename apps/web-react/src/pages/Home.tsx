import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Vehicle } from '@/types';
import { listVehicles } from '@/lib/api';
import { MAKES, getModelsForMake } from '@/data/makes-models';
import { VehicleCard } from '@/components/VehicleCard';
import { Button, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@blinkdotnew/ui';
import {
  Search,
  X,
  ArrowRight,
  MapPin,
  BadgeCheck,
  FileText,
  ShieldCheck,
  Lock,
  Navigation,
} from 'lucide-react';

// ── Beta Notice Banner ──────────────────────────────────────────────────────
function BetaBanner() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('kerodex_beta_dismissed') === 'true'
  );

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem('kerodex_beta_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div
      id="beta-notice"
      data-dismissible="true"
      className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between gap-4"
      role="alert"
    >
      <p className="text-[12px] text-amber-800 dark:text-amber-300 font-medium flex-1 text-center">
        <span className="font-bold">⚠ Kerodex is in beta</span> — listings are demo data. Some features may be incomplete.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss beta notice"
        className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <div className="space-y-2 p-1">
        <div className="h-3.5 w-3/4 bg-muted animate-pulse" />
        <div className="h-3 w-1/2 bg-muted animate-pulse" />
        <div className="h-3 w-1/3 bg-muted animate-pulse" />
      </div>
    </div>
  );
}

// ── Trust Pillar ─────────────────────────────────────────────────────────────
interface TrustPillarProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function TrustPillar({ icon, title, description }: TrustPillarProps) {
  return (
    <div className="space-y-4">
      <div className="w-10 h-10 border border-border flex items-center justify-center">
        {icon}
      </div>
      <h4 className="text-[12px] font-bold uppercase tracking-[0.15em]">{title}</h4>
      <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ── Main Home Page ───────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate();

  // Hero search state
  const [heroCity, setHeroCity] = useState('');
  const [heroMake, setHeroMake] = useState('');
  const [heroModel, setHeroModel] = useState('');
  const heroModels = heroMake ? getModelsForMake(heroMake) : [];

  // Reset model when make changes
  useEffect(() => {
    setHeroModel('');
  }, [heroMake]);

  // Location section state
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');

  const handleEnableLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationEnabled(true);
        setLocationError('');
      },
      () => {
        setLocationError('Unable to retrieve your location. Please try again.');
      }
    );
  };

  // Featured vehicles
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles', 'home-featured'],
    queryFn: async () => {
      const result = await listVehicles();
      return result.slice(0, 8) as Vehicle[];
    },
  });

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (heroCity) params.q = heroCity;
    if (heroMake) params.make = heroMake;
    if (heroModel) params.model = heroModel;
    navigate({ to: '/search', search: params as any });
  };

  return (
    <div>
      <BetaBanner />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 border-b border-border">
        <div className="max-w-screen-xl mx-auto">
          {/* Label */}
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-5">
            Private-Party Marketplace
          </p>

          <h1 className="text-4xl md:text-[56px] lg:text-[68px] font-black tracking-tighter leading-[0.95] mb-5 max-w-3xl">
            Private-party cars.<br />
            <span className="text-muted-foreground">Verified by Kerodex.</span>
          </h1>

          <p className="text-[14px] md:text-[15px] text-muted-foreground leading-relaxed mb-10 max-w-xl">
            Browse real listings from real owners. Priced fairly, verified honestly. No dealers. No surprises.
          </p>

          {/* Hero search form */}
          <form
            id="hero-search-form"
            onSubmit={handleHeroSearch}
            className="flex flex-col md:flex-row gap-0 border border-border w-full max-w-3xl"
          >
            {/* City / ZIP */}
            <div className="relative flex-1 border-b md:border-b-0 md:border-r border-border">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                id="hero-city-input"
                type="text"
                placeholder="City or ZIP code"
                value={heroCity}
                onChange={(e) => setHeroCity(e.target.value)}
                className="w-full h-12 pl-9 pr-3 text-[13px] bg-background text-foreground placeholder:text-muted-foreground outline-none border-none"
              />
            </div>

            {/* Make */}
            <div className="border-b md:border-b-0 md:border-r border-border min-w-[140px]">
              <select
                id="hero-make-select"
                value={heroMake}
                onChange={(e) => setHeroMake(e.target.value)}
                className="w-full h-12 px-3 text-[13px] bg-background text-foreground outline-none border-none appearance-none cursor-pointer"
              >
                <option value="">Any Make</option>
                {MAKES.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div className="border-b md:border-b-0 md:border-r border-border min-w-[140px]">
              <select
                id="hero-model-select"
                value={heroModel}
                onChange={(e) => setHeroModel(e.target.value)}
                disabled={!heroMake}
                className="w-full h-12 px-3 text-[13px] bg-background text-foreground outline-none border-none appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Any Model</option>
                {heroModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Search button */}
            <button
              id="hero-search-btn"
              type="submit"
              className="h-12 px-6 bg-foreground text-background text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2 justify-center shrink-0"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {/* Quick link */}
          <div className="mt-4 flex items-center gap-4">
            <Link
              to="/search"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 flex items-center gap-1"
            >
              <Navigation className="h-3 w-3" /> Browse nearby cars
            </Link>
            <span className="text-border">·</span>
            <Link
              to="/search"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              View all listings
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED VEHICLES ─────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-20">
        <div className="max-w-screen-xl mx-auto">
          {/* Section header */}
          <div className="flex items-end justify-between mb-8 md:mb-12">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">
                Latest Arrivals
              </p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                Just listed
              </h2>
            </div>
            <Link
              to="/search"
              className="group flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider hover:text-muted-foreground transition-colors"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Horizontal scroll on mobile, grid on desktop */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : !vehicles || vehicles.length === 0 ? (
            <div className="border border-dashed border-border py-16 text-center">
              <p className="text-[13px] text-muted-foreground">No vehicles listed yet. Check back soon.</p>
            </div>
          ) : (
            <>
              {/* Mobile: horizontal scroll */}
              <div className="md:hidden flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
                {vehicles.slice(0, 8).map((vehicle) => (
                  <div key={vehicle.id} className="w-[260px] shrink-0 snap-start">
                    <VehicleCard vehicle={vehicle} />
                  </div>
                ))}
              </div>

              {/* Desktop: 4-col grid */}
              <div className="hidden md:grid grid-cols-4 gap-6">
                {vehicles.slice(0, 4).map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── MAP PREVIEW ─────────────────────────────────────────────────────── */}
      <section
        id="location-section"
        className="px-4 md:px-6 py-16 border-t border-b border-border bg-muted/30"
      >
        <div className="max-w-screen-xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
                Near You
              </p>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
                Listings near you
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-8 max-w-sm">
                Enable location access to see cars available within your area. Browse hundreds of verified private-party listings within driving distance.
              </p>

              {locationError && (
                <p className="text-[12px] text-destructive mb-4">{locationError}</p>
              )}

              {locationEnabled ? (
                <div className="flex items-center gap-2 text-[12px] font-medium">
                  <div className="w-2 h-2 bg-foreground" />
                  Location enabled — showing nearby results
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleEnableLocation}
                    className="h-10 px-5 text-[11px] font-bold uppercase tracking-wider"
                  >
                    <Navigation className="h-3.5 w-3.5 mr-2" />
                    Enable Location
                  </Button>
                  <Link to="/search">
                    <Button
                      variant="outline"
                      className="h-10 px-5 text-[11px] font-bold uppercase tracking-wider"
                    >
                      Browse All Cities
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Map placeholder */}
            <div className="relative h-64 md:h-80 lg:h-96 bg-muted border border-border overflow-hidden">
              {/* Grid overlay for map feel */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Mock map pins */}
              <div className="absolute top-[30%] left-[40%] w-8 h-8 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap">$24,500</div>
              </div>
              <div className="absolute top-[55%] left-[62%] w-8 h-8 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap">$18,900</div>
              </div>
              <div className="absolute top-[25%] left-[70%] w-8 h-8 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap">$47,000</div>
              </div>
              <div className="absolute top-[65%] left-[28%] w-8 h-8 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-background text-foreground border border-border text-[9px] font-bold px-1.5 py-0.5 whitespace-nowrap">$31,200</div>
              </div>

              {/* Center overlay label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <MapPin className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-[12px] text-muted-foreground font-medium">Map loading…</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Enable location to populate pins</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST / SAFETY ──────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24">
        <div className="max-w-screen-xl mx-auto">
          <div className="mb-12 md:mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Built for Safety
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight max-w-xl">
              Private-party buying, made safer.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12">
            <TrustPillar
              icon={<BadgeCheck className="h-4 w-4" />}
              title="Verified Sellers"
              description="Every seller goes through our ID and phone verification process. You always know who you're dealing with before you show up."
            />
            <TrustPillar
              icon={<FileText className="h-4 w-4" />}
              title="Title Confidence"
              description="We check for salvage titles, open liens, and branded titles automatically. Every listing discloses title history upfront."
            />
            <TrustPillar
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Scam Screening"
              description="Our automated systems detect and remove suspicious listings before they ever reach you. Real cars, real owners only."
            />
            <TrustPillar
              icon={<Lock className="h-4 w-4" />}
              title="Safer Private-Party"
              description="Meet safely with public meetup location suggestions and real-time messaging. We never share your personal contact details."
            />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 bg-foreground text-background">
        <div className="max-w-screen-xl mx-auto">
          <div className="mb-12 md:mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-50 mb-3">
              How It Works
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              Three steps to your next car.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-px border border-background/20">
            {[
              {
                step: '01',
                title: 'List',
                sub: 'Sellers',
                description: 'Create your listing in minutes. Upload photos, enter VIN, and set your price. We walk you through everything.',
              },
              {
                step: '02',
                title: 'Verify',
                sub: 'Kerodex',
                description: 'We review your listing, run title checks, and apply a verified badge. Buyers see your car with full confidence.',
              },
              {
                step: '03',
                title: 'Connect',
                sub: 'Buyers & Sellers',
                description: 'Serious buyers message directly through our platform. No spam, no bots. Schedule viewings and close the deal.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-background/20 last:border-0"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-40 mb-6">
                  {item.step} · {item.sub}
                </div>
                <h3 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-none">
                  {item.title}
                </h3>
                <p className="text-[13px] opacity-70 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link to="/search">
              <Button
                variant="outline"
                className="h-11 px-8 text-[11px] font-bold uppercase tracking-wider border-background/40 text-background hover:bg-background hover:text-foreground"
              >
                Browse Cars
              </Button>
            </Link>
            <Link to="/sell">
              <Button className="h-11 px-8 text-[11px] font-bold uppercase tracking-wider bg-background text-foreground hover:bg-background/90">
                Sell Your Car
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
