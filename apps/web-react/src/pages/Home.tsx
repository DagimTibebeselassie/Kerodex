import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Vehicle } from '@/types';
import { MAKES, getModelsForMake } from '@/data/makes-models';
import { VehicleCard } from '@/components/VehicleCard';
import { MapView } from '@/components/MapView';
import { BuyerGuideEntryCard } from '@/components/buyer-guide/BuyerGuideComponents';
import { currentUser, listVehicles } from '@/lib/api';
import { Button } from '@blinkdotnew/ui';
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
  MessageCircle,
} from 'lucide-react';

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
        <span className="font-bold">Kerodex is in beta</span> - demonstration listings are clearly labeled and are not actually for sale.
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

interface VehicleRowSectionProps {
  label: string;
  heading: string;
  vehicles: Vehicle[];
  viewAllHref?: string;
}

function VehicleRowSection({ label, heading, vehicles, viewAllHref = '/cars' }: VehicleRowSectionProps) {
  if (!vehicles.length) return null;

  return (
    <section className="px-4 md:px-6 py-12 md:py-16 border-t border-border">
      <div className="max-w-screen-xl mx-auto min-w-0">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8 md:mb-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">
              {label}
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              {heading}
            </h2>
          </div>
          <Link
            to={viewAllHref as any}
            className="group flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider hover:text-muted-foreground transition-colors shrink-0"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="kerodex-vehicle-rail flex gap-4 md:gap-6 overflow-x-auto pb-4 px-1 sm:px-0 snap-x snap-mandatory">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="w-[260px] sm:w-[286px] lg:w-[300px] shrink-0 snap-start">
              <VehicleCard vehicle={vehicle} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureAdProps {
  label: string;
  headline: string;
  copy: string;
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
}

function FeatureAd({ label, headline, copy, cta, href, image, imageAlt, reverse = false }: FeatureAdProps) {
  return (
    <section className="px-4 md:px-6 py-14 md:py-20 border-t border-border">
      <div className="max-w-screen-xl mx-auto">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center ${reverse ? '' : ''}`}>
          <div className={`${reverse ? 'lg:order-2' : 'lg:order-1'} overflow-hidden border border-border bg-muted/30`}>
            <img
              src={image}
              alt={imageAlt}
              className="w-full aspect-[4/3] md:aspect-[16/11] object-cover"
              loading="lazy"
            />
          </div>
          <div className={`${reverse ? 'lg:order-1' : 'lg:order-2'} max-w-xl ${reverse ? '' : 'lg:ml-auto'}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-4">
              {label}
            </p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-5">
              {headline}
            </h2>
            <p className="text-[13px] md:text-[14px] text-muted-foreground leading-relaxed mb-8">
              {copy}
            </p>
            <Link to={href as any}>
              <Button className="h-10 px-5 text-[11px] font-bold uppercase tracking-wider">
                {cta}
                <ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function distanceMiles(lat1: number, lng1: number, lat2?: number, lng2?: number) {
  if (!Number.isFinite(Number(lat2)) || !Number.isFinite(Number(lng2))) return Number.POSITIVE_INFINITY;
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(Number(lat2) - lat1);
  const dLng = toRad(Number(lng2) - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(Number(lat2))) *
    Math.sin(dLng / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(a));
}

function cityName(location = '') {
  return location.split(',')[0]?.trim() || 'your area';
}

function uniqueVehicles(vehicles: Vehicle[]) {
  const seen = new Set<string>();
  return vehicles.filter((vehicle) => {
    if (seen.has(vehicle.id)) return false;
    seen.add(vehicle.id);
    return true;
  });
}

function vehicleMatchesType(vehicle: Vehicle, type: string) {
  const normalized = type.toLowerCase();
  const fields = [
    vehicle.bodyType,
    vehicle.fuelType,
    vehicle.make,
    vehicle.model,
    vehicle.description,
    ...(vehicle.features || []),
  ].join(' ').toLowerCase();
  if (normalized === 'ev') return fields.includes('electric') || fields.includes(' ev');
  if (normalized === 'sports car') return fields.includes('sports') || fields.includes('coupe') || fields.includes('performance');
  return fields.includes(normalized);
}

const CHAT_CHIPS = [
  'Help me price my car',
  'Detect potential scams',
  'Write my listing',
  'Compare vehicles',
];

function ChatbotWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {/* Panel */}
      {open && (
        <div className="w-72 bg-background border border-border shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold">Kerodex Assistant</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">
                Coming Soon
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant panel"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              AI-powered help is on its way. Until then, try:
            </p>
            <div className="flex flex-col gap-2">
              {CHAT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  className="text-left text-[12px] px-3 py-2 border border-border hover:border-foreground/30 hover:bg-muted/50 transition-colors text-foreground"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <p className="text-[11px] text-muted-foreground text-center">
              Full AI assistant launching soon
            </p>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Kerodex Assistant"
        className="h-14 w-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const user = currentUser();

  // Hero search state
  const [heroCity, setHeroCity] = useState('');
  const [heroMake, setHeroMake] = useState('');
  const [heroModel, setHeroModel] = useState('');
  const heroModels = heroMake ? getModelsForMake(heroMake) : [];
  const [marketVehicles, setMarketVehicles] = useState<Vehicle[]>([]);

  // Reset model when make changes
  useEffect(() => {
    setHeroModel('');
  }, [heroMake]);

  useEffect(() => {
    let mounted = true;
    listVehicles()
      .then((vehicles) => {
        if (mounted) setMarketVehicles(vehicles);
      })
      .catch(() => {
        if (mounted) setMarketVehicles([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Location section state
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Dark mode detection for map
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleEnableLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationEnabled(true);
        setLocationError('');
      },
      () => {
        setLocationError('Unable to retrieve your location. Please try again.');
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (heroCity) params.q = heroCity;
    if (heroMake) params.make = heroMake;
    if (heroModel) params.model = heroModel;
    navigate({ to: '/cars', search: params as any });
  };

  const handleBrowseNearby = () => {
    if (!navigator.geolocation) {
      navigate({ to: '/cars', search: { nearby: '1', radius: '100', sort: 'closest', lat: '33.749', lng: '-84.388' } as any });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        navigate({
          to: '/cars',
          search: {
            nearby: '1',
            radius: '100',
            sort: 'closest',
            lat: String(position.coords.latitude),
            lng: String(position.coords.longitude),
          } as any,
        });
      },
      () => {
        navigate({ to: '/cars', search: { nearby: '1', radius: '100', sort: 'closest', lat: '33.749', lng: '-84.388' } as any });
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  };

  const latestVehicles = marketVehicles.slice(0, 12);
  const bestDealVehicles = marketVehicles
    .filter((vehicle) => Number((vehicle as any).fairValueDelta || 0) <= 0)
    .slice(0, 12);
  const evHybridVehicles = marketVehicles
    .filter((vehicle) => ['electric', 'hybrid'].includes(String(vehicle.fuelType || '').toLowerCase()))
    .slice(0, 12);
  const lowMileageVehicles = [...marketVehicles]
    .sort((a, b) => Number(a.mileage || 0) - Number(b.mileage || 0))
    .slice(0, 12);
  const budgetVehicles = marketVehicles
    .filter((vehicle) => Number(vehicle.price || 0) <= 25000)
    .slice(0, 12);
  const anchorLocation = userLocation || { lat: 33.749, lng: -84.388 };
  const nearbySortedVehicles = [...marketVehicles]
    .map((vehicle) => ({
      vehicle,
      distance: distanceMiles(anchorLocation.lat, anchorLocation.lng, vehicle.lat, vehicle.lng),
    }))
    .filter((item) => item.distance <= 100)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.vehicle);
  const nearbyCity = userLocation
    ? cityName(nearbySortedVehicles[0]?.location || 'your area')
    : cityName(nearbySortedVehicles[0]?.location || 'Atlanta, GA');
  const nearbyVehicles = nearbySortedVehicles.slice(0, 12);
  const nearbyEfficientVehicles = nearbySortedVehicles
    .filter((vehicle) => {
      const fuel = String(vehicle.fuelType || '').toLowerCase();
      return fuel.includes('hybrid') || fuel.includes('electric') || Number(vehicle.mileage || 0) <= 45000;
    })
    .slice(0, 12);
  const nearbySearchHref = `/cars?nearby=1&radius=100&sort=closest&lat=${anchorLocation.lat}&lng=${anchorLocation.lng}`;
  const favoriteBrandRows = (user?.favoriteBrands || [])
    .slice(0, 4)
    .map((brand) => {
      const vehicles = marketVehicles
        .filter((vehicle) => vehicle.make.toLowerCase() === brand.toLowerCase())
        .slice(0, 12);
      return {
        label: 'For You',
        heading: `${brand.replace(/_/g, ' ')} picks`,
        vehicles,
        viewAllHref: `/cars?make=${encodeURIComponent(brand)}`,
      };
    })
    .filter((row) => row.vehicles.length);
  const preferredTypeRows = (user?.preferredVehicleTypes || [])
    .slice(0, 4)
    .map((type) => {
      const vehicles = marketVehicles
        .filter((vehicle) => vehicleMatchesType(vehicle, type))
        .slice(0, 12);
      return {
        label: 'Matched Preference',
        heading: `${type} listings`,
        vehicles,
        viewAllHref: `/cars?q=${encodeURIComponent(type)}`,
      };
    })
    .filter((row) => row.vehicles.length);
  const personalizedRows = [
    ...favoriteBrandRows,
    ...preferredTypeRows,
    {
      label: 'Personalized',
      heading: 'Recommended for you',
      vehicles: uniqueVehicles([
        ...favoriteBrandRows.flatMap((row) => row.vehicles),
        ...preferredTypeRows.flatMap((row) => row.vehicles),
      ]).slice(0, 12),
      viewAllHref: '/cars',
    },
  ].filter((row) => row.vehicles.length).slice(0, 4);
  const vehicleRowSections = [
    ...personalizedRows,
    {
      label: 'Best Deals',
      heading: 'Priced below market',
      vehicles: bestDealVehicles,
      viewAllHref: '/cars',
    },
    {
      label: 'Electric & Hybrid',
      heading: 'Go electric',
      vehicles: evHybridVehicles,
      viewAllHref: '/cars',
    },
    {
      label: 'Low Mileage',
      heading: 'Nearly new',
      vehicles: lowMileageVehicles,
      viewAllHref: '/cars',
    },
    {
      label: 'Budget Picks',
      heading: 'Under $25,000',
      vehicles: budgetVehicles,
      viewAllHref: '/cars',
    },
    {
      label: 'Near You',
      heading: `Cars in ${nearbyCity}`,
      vehicles: nearbyVehicles,
      viewAllHref: nearbySearchHref,
    },
    {
      label: 'Recommended Nearby',
      heading: 'Efficient picks close by',
      vehicles: nearbyEfficientVehicles,
      viewAllHref: nearbySearchHref,
    },
  ].filter((row) => row.vehicles.length);
  const rowsBeforeBuyerGuide = vehicleRowSections.slice(0, 1);
  const rowsBeforeVerification = vehicleRowSections.slice(1, 3);
  const remainingRows = vehicleRowSections.slice(3);
  const rowsBetweenVerificationFeatures = remainingRows.slice(0, 2);
  const rowsAfterIdentityVerification = remainingRows.slice(2);

  return (
    <div>
      <BetaBanner />

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
            <button
              type="button"
              onClick={handleBrowseNearby}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 flex items-center gap-1"
            >
              <Navigation className="h-3 w-3" /> Browse nearby cars
            </button>
            <span className="text-border" aria-hidden="true">&middot;</span>
            <Link
              to="/cars"
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              View all listings
            </Link>
          </div>

          <div className="mt-8 max-w-3xl">
            <BuyerGuideEntryCard compact />
          </div>
        </div>
      </section>

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
              to="/cars"
              className="group flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider hover:text-muted-foreground transition-colors"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="kerodex-vehicle-rail flex gap-4 md:gap-6 overflow-x-auto pb-4 px-1 sm:px-0 snap-x snap-mandatory">
            {latestVehicles.map((vehicle) => (
              <div key={vehicle.id} className="w-[260px] sm:w-[286px] lg:w-[300px] shrink-0 snap-start">
                <VehicleCard vehicle={vehicle} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {rowsBeforeBuyerGuide.map((row) => (
        <VehicleRowSection
          key={`${row.label}-${row.heading}`}
          label={row.label}
          heading={row.heading}
          vehicles={row.vehicles}
          viewAllHref={row.viewAllHref}
        />
      ))}

      <FeatureAd
        label="Buyer Guide"
        headline="Buy with confidence"
        copy="Use Kerodex's buyer guide to understand what to inspect, what documents to collect, and how to complete a safer private-party purchase."
        cta="View Buyer Guide"
        href="/feature-tour"
        image="/assets/buyerflow.png"
        imageAlt="Illustration of the Kerodex buyer guide flow"
      />

      {rowsBeforeVerification.map((row) => (
        <VehicleRowSection
          key={`${row.label}-${row.heading}`}
          label={row.label}
          heading={row.heading}
          vehicles={row.vehicles}
          viewAllHref={row.viewAllHref}
        />
      ))}

      <FeatureAd
        label="Vehicle Presence Verification"
        headline="Know the vehicle is really there"
        copy="Kerodex helps sellers prove vehicle presence before buyers waste time on questionable listings."
        cta="See how verification works"
        href="/verify"
        image="/assets/verifiedseller.png"
        imageAlt="Illustration of Kerodex vehicle presence verification"
        reverse
      />

      {rowsBetweenVerificationFeatures.map((row) => (
        <VehicleRowSection
          key={`${row.label}-${row.heading}`}
          label={row.label}
          heading={row.heading}
          vehicles={row.vehicles}
          viewAllHref={row.viewAllHref}
        />
      ))}

      <FeatureAd
        label="Identity Verification"
        headline="Verify who you're dealing with"
        copy="Optional identity verification helps buyers and sellers build trust before meeting, messaging, or completing a transaction."
        cta="Learn about verification"
        href="/verify"
        image="/Dagim_editorial_vector_illustration_vehicle_verification_conc_466c222c-fe96-4e55-80ec-9d17c19483a1_1.png"
        imageAlt="Illustration of optional Kerodex identity verification for marketplace trust and safety"
      />

      {rowsAfterIdentityVerification.map((row) => (
        <VehicleRowSection
          key={`${row.label}-${row.heading}`}
          label={row.label}
          heading={row.heading}
          vehicles={row.vehicles}
          viewAllHref={row.viewAllHref}
        />
      ))}

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
                  Location enabled - showing nearby results
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
                  <Link to="/cars">
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

            {/* Real Leaflet map */}
            <div className="relative h-64 md:h-80 lg:h-96 border border-border overflow-hidden">
              <MapView
                vehicles={marketVehicles}
                isDark={isDark}
                userLocation={userLocation}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </section>

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
              description="Sellers can complete optional identity and phone verification to add stronger trust signals before buyers message or meet them."
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
                  {item.step} <span aria-hidden="true">&middot;</span> {item.sub}
                </div>
                <h3 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-none">
                  {item.title}
                </h3>
                <p className="text-[13px] opacity-70 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link to="/cars">
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

      <ChatbotWidget />
    </div>
  );
}
