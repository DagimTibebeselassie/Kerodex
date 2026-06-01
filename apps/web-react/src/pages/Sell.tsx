import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button, toast } from '@blinkdotnew/ui';
import { MAKES, MAKES_MODELS } from '@/data/makes-models';
import { createVehicle } from '@/lib/api';
import {
  Camera, X, Loader2, Search, BadgeCheck, CheckCircle2,
  MapPin, ChevronDown, AlertCircle,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = CURRENT_YEAR; y >= 1980; y--) YEARS.push(y);

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Needs Work'] as const;
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'CVT'] as const;
const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric', 'Flex Fuel'] as const;
const DRIVE_OPTIONS = ['FWD', 'RWD', 'AWD', '4WD'] as const;
const LOCATION_OPTIONS = [
  { label: 'Brooklyn, NY', lat: 40.6782, lng: -73.9442 },
  { label: 'Hoboken, NJ', lat: 40.7433, lng: -74.0324 },
  { label: 'Jersey City, NJ', lat: 40.7178, lng: -74.0431 },
  { label: 'Atlanta, GA', lat: 33.7490, lng: -84.3880 },
  { label: 'Dallas, TX', lat: 32.7767, lng: -96.7970 },
  { label: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
  { label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { label: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
  { label: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
  { label: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
];

// ── Schema ────────────────────────────────────────────────────────────────
const vehicleSchema = z.object({
  vin:          z.string().optional(),
  make:         z.string().min(1, 'Make is required'),
  model:        z.string().min(1, 'Model is required'),
  year:         z.coerce.number().min(1980).max(CURRENT_YEAR + 1),
  trim:         z.string().optional(),
  price:        z.coerce.number().min(100, 'Price must be at least $100'),
  mileage:      z.coerce.number().min(0),
  location:     z.string().min(2, 'Location is required'),
  condition:    z.string().min(1, 'Condition is required'),
  transmission: z.string().optional(),
  fuelType:     z.string().optional(),
  driveType:    z.string().optional(),
  description:  z.string().min(20, 'Description must be at least 20 characters'),
});
type VehicleForm = z.infer<typeof vehicleSchema>;

// ── VIN decode via NHTSA (free, no key) ──────────────────────────────────
interface VinData {
  make: string; model: string; year: string; trim: string;
  engine: string; fuelType: string; driveType: string; transmission: string;
}
async function fetchVin(vin: string): Promise<VinData | null> {
  try {
    const r = await fetch(`/api/vin/decode/${encodeURIComponent(vin.trim().toUpperCase())}`);
    const body = await r.json();
    const d = body.vehicle || body;
    if (!r.ok) return null;
    if (!d || d.ErrorCode === '8' || !d.make) return null;
    return {
      make:         d.make         || '',
      model:        d.model        || '',
      year:         d.year         || '',
      trim:         d.trim         || '',
      engine:       d.engine || d.bodyClass || '',
      fuelType:     d.fuelType || '',
      driveType:    d.driveType    || '',
      transmission: d.transmission || 'Automatic',
    };
  } catch { return null; }
}

// ── City normalizer (simple title-case) ──────────────────────────────────
function normalizeLocation(raw: string): string {
  return raw
    .split(/\s*,\s*/)
    .map((part) => part.trim()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    )
    .join(', ');
}

function geocodeDemoLocation(location: string) {
  const normalized = normalizeLocation(location);
  return LOCATION_OPTIONS.find((item) => item.label.toLowerCase() === normalized.toLowerCase()) || null;
}

function nearestSupportedLocation(lat: number, lng: number) {
  return LOCATION_OPTIONS.reduce((best, item) => {
    const distance = Math.hypot(item.lat - lat, item.lng - lng);
    return distance < best.distance ? { item, distance } : best;
  }, { item: LOCATION_OPTIONS[0], distance: Number.POSITIVE_INFINITY }).item;
}

// ── FormField helper ──────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{msg}</p>;
}
function NativeSelect({ value, onChange, options, placeholder, disabled, id }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
  disabled?: boolean; id?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-10 pl-3 pr-8 text-[13px] border border-input bg-background text-foreground outline-none
          focus:border-ring focus:ring-1 focus:ring-ring transition-colors appearance-none
          disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ── Image upload item ─────────────────────────────────────────────────────
function ImageItem({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square bg-muted border border-border rounded-md overflow-hidden group">
      <img src={url} alt="" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Main Sell Page ─────────────────────────────────────────────────────────
export function SellPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as any;

  const [images, setImages] = useState<string[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listingCoords, setListingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationFocused, setLocationFocused] = useState(false);

  // VIN decode state
  const [vin, setVin] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinVerified, setVinVerified] = useState(false);
  const [vinError, setVinError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema) as any,
    defaultValues: {
      year:         CURRENT_YEAR,
      condition:    'Good',
      transmission: 'Automatic',
      fuelType:     'Gasoline',
      driveType:    'AWD',
      // Pre-fill from cockpit VIN decode navigation
      make:  searchParams?.make  || '',
      model: searchParams?.model || '',
    },
  });

  const watchedMake = watch('make');
  const watchedLocation = watch('location') || '';
  const modelOptions = watchedMake ? (MAKES_MODELS[watchedMake] || []) : [];
  const locationMatches = LOCATION_OPTIONS
    .filter((item) => item.label.toLowerCase().startsWith(watchedLocation.trim().toLowerCase()))
    .slice(0, 6);

  // Reset model when make changes
  useEffect(() => { setValue('model', ''); }, [watchedMake, setValue]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = nearestSupportedLocation(position.coords.latitude, position.coords.longitude);
        setListingCoords({ lat: nearest.lat, lng: nearest.lng });
        setValue('location', nearest.label, { shouldDirty: true, shouldValidate: true });
        setLocationError('');
      },
      () => setLocationError('Unable to access your location. Check browser location permissions and try again.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // ── VIN Autofill ─────────────────────────────────────────────────────
  const handleVinDecode = useCallback(async () => {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
      setVinError('VIN must be exactly 17 characters');
      return;
    }
    setVinError('');
    setVinLoading(true);
    const data = await fetchVin(cleaned);
    setVinLoading(false);

    if (!data || !data.make) {
      setVinError('VIN not found. Check the number and try again.');
      return;
    }

    // Auto-populate form fields
    if (data.make)  setValue('make',  data.make,  { shouldDirty: true });
    if (data.model) setValue('model', data.model, { shouldDirty: true });
    if (data.year)  setValue('year',  Number(data.year), { shouldDirty: true });
    if (data.trim)  setValue('trim',  data.trim,  { shouldDirty: true });
    if (data.fuelType && FUEL_OPTIONS.includes(data.fuelType as any))
      setValue('fuelType', data.fuelType, { shouldDirty: true });
    if (data.transmission)
      setValue('transmission', data.transmission, { shouldDirty: true });

    setVinVerified(true);
    setValue('vin', cleaned);
    toast.success(`VIN decoded — ${data.year} ${data.make} ${data.model} auto-filled`);
  }, [vin, setValue]);

  // ── Image upload ──────────────────────────────────────────────────────
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!user) { login(); return; }

    for (let i = 0; i < files.length; i++) {
      if (images.length + i >= 8) break;
      const file = files[i];

      // Validate file
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10 MB)`);
        continue;
      }

      setUploadingIdx(images.length + i);
      try {
        const url = URL.createObjectURL(file);
        setImages((prev) => [...prev, url]);
      } catch (err: any) {
        console.error('Upload error:', err);
        toast.error('Image upload failed. Make sure you are signed in and try again.');
      } finally {
        setUploadingIdx(null);
      }
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const onSubmit = async (data: VehicleForm) => {
    if (!user) { login(); return; }
    if (images.length === 0) {
      toast.error('Please add at least one photo of your vehicle.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Normalize location (e.g. "atlanta georgia" → "Atlanta, Georgia")
      const location = normalizeLocation(data.location);
      const matchedLocation = geocodeDemoLocation(location);
      const coords = listingCoords || (matchedLocation ? { lat: matchedLocation.lat, lng: matchedLocation.lng } : null);
      if (!matchedLocation && !listingCoords) {
        toast.error('Choose a valid city from the location suggestions.');
        return;
      }

      const vehicle = await createVehicle({
        userId:      user.id,
        vin:         vin || undefined,
        make:        data.make,
        model:       data.model,
        trim:        data.trim || undefined,
        year:        data.year,
        price:       data.price,
        mileage:     data.mileage,
        location,
        lat:         coords?.lat,
        lng:         coords?.lng,
        description: data.description,
        images,
        status:      'available',
      });

      toast.success('Listing published successfully!');
      navigate({ to: '/vehicle/$id', params: { id: vehicle.id } });
    } catch (err) {
      console.error('Create listing error:', err);
      toast.error('Failed to create listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Auth gate ─────────────────────────────────────────────────────────
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
        <Camera className="h-12 w-12 text-muted-foreground mb-6" />
        <h2 className="text-xl font-bold mb-2">Sign in to list your vehicle</h2>
        <p className="text-muted-foreground text-[13px] mb-8 max-w-xs">
          Create a free account to list your car on Kerodex.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In / Create Account
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-md mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-2">Sell on Kerodex</p>
        <h1 className="text-3xl font-black tracking-tight mb-2">List Your Vehicle</h1>
        <p className="text-[13px] text-muted-foreground">Fill out the form below. Use VIN autofill to save time.</p>
      </div>

      {/* ── VIN Autofill Banner ───────────────────────────────────────── */}
      <div className="mb-8 p-5 border border-primary/20 bg-primary/5 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-primary">VIN Autofill</span>
          <span className="text-[11px] text-muted-foreground ml-1">— Enter your 17-digit VIN to auto-populate the form</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={vin}
            onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinVerified(false); setVinError(''); }}
            placeholder="e.g. 1HGBH41JX8C200001"
            maxLength={17}
            className="flex-1 h-10 px-3 text-[13px] font-mono uppercase border border-input bg-background text-foreground
              placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring
              transition-colors rounded-md"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVinDecode(); } }}
          />
          <Button
            type="button"
            onClick={handleVinDecode}
            disabled={vinLoading || vin.length !== 17}
            className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider shrink-0"
          >
            {vinLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Search className="h-3.5 w-3.5 mr-1.5" />Decode</>}
          </Button>
        </div>
        {vinError && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />{vinError}
          </p>
        )}
        {vinVerified && (
          <p className="text-[11px] text-primary font-bold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />VIN verified — form fields have been auto-populated
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Character count: <strong>{vin.length}/17</strong>
          {vin.length > 0 && vin.length < 17 && ' — keep typing…'}
          {vin.length === 17 && ' ✓'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-10">

        {/* ── Photos ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-[0.15em] mb-1">Photos</h2>
            <p className="text-[12px] text-muted-foreground">Add up to 8 photos. First photo is the cover image.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((url, i) => (
              <ImageItem key={i} url={url} onRemove={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} />
            ))}

            {/* Uploading placeholder */}
            {uploadingIdx !== null && (
              <div className="aspect-square border border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-2 rounded-md">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground">Uploading…</span>
              </div>
            )}

            {/* Add photo button */}
            {images.length < 8 && uploadingIdx === null && (
              <label className="aspect-square border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors rounded-md">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Add Photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageFiles(e.target.files)}
                />
              </label>
            )}
          </div>

          {images.length === 0 && (
            <p className="text-[11px] text-amber-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />At least one photo is required to publish.
            </p>
          )}
        </section>

        {/* ── Vehicle Info ──────────────────────────────────────────── */}
        <section className="space-y-5">
          <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">Vehicle Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Make */}
            <div>
              <FieldLabel required>Make</FieldLabel>
              <Controller
                name="make"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    id="make-select"
                    value={field.value}
                    onChange={field.onChange}
                    options={MAKES}
                    placeholder="Select Make"
                  />
                )}
              />
              <FieldError msg={errors.make?.message} />
            </div>

            {/* Model */}
            <div>
              <FieldLabel required>Model</FieldLabel>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    id="model-select"
                    value={field.value}
                    onChange={field.onChange}
                    options={modelOptions}
                    placeholder={watchedMake ? 'Select Model' : 'Select Make first'}
                    disabled={!watchedMake}
                  />
                )}
              />
              <FieldError msg={errors.model?.message} />
            </div>

            {/* Year */}
            <div>
              <FieldLabel required>Year</FieldLabel>
              <Controller
                name="year"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    id="year-select"
                    value={String(field.value)}
                    onChange={(v) => field.onChange(Number(v))}
                    options={YEARS.map(String)}
                    placeholder="Select Year"
                  />
                )}
              />
              <FieldError msg={errors.year?.message} />
            </div>

            {/* Trim */}
            <div>
              <FieldLabel>Trim</FieldLabel>
              <input
                {...register('trim')}
                placeholder="e.g. EX-L, Sport, Premium"
                className="w-full h-10 px-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
              />
            </div>

            {/* Mileage */}
            <div>
              <FieldLabel required>Mileage</FieldLabel>
              <input
                {...register('mileage')}
                type="number"
                min={0}
                placeholder="e.g. 45000"
                className="w-full h-10 px-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
              />
              <FieldError msg={errors.mileage?.message} />
            </div>

            {/* Price */}
            <div>
              <FieldLabel required>Asking Price ($)</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                <input
                  {...register('price')}
                  type="number"
                  min={0}
                  placeholder="e.g. 18500"
                  className="w-full h-10 pl-6 pr-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                />
              </div>
              <FieldError msg={errors.price?.message} />
            </div>

            {/* Condition */}
            <div>
              <FieldLabel required>Condition</FieldLabel>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={[...CONDITION_OPTIONS]}
                    placeholder="Select Condition"
                  />
                )}
              />
              <FieldError msg={errors.condition?.message} />
            </div>

            {/* Location */}
            <div>
              <FieldLabel required>Location</FieldLabel>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => {
                        setListingCoords(null);
                        setLocationError('');
                        field.onChange(e.target.value);
                      }}
                      onFocus={() => setLocationFocused(true)}
                      onBlur={() => setTimeout(() => setLocationFocused(false), 120)}
                      placeholder="Start typing a city"
                      className="w-full h-10 pl-9 pr-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                    />
                  )}
                />
                {locationFocused && watchedLocation.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 border border-border bg-background shadow-lg rounded-md overflow-hidden">
                    {locationMatches.length ? locationMatches.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setValue('location', item.label, { shouldDirty: true, shouldValidate: true });
                          setListingCoords({ lat: item.lat, lng: item.lng });
                          setLocationFocused(false);
                          setLocationError('');
                        }}
                        className="w-full h-10 px-3 text-left text-[13px] hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.label}
                      </button>
                    )) : (
                      <div className="px-3 py-3 text-[12px] text-muted-foreground">
                        No matching city. Choose a supported city from the list.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-muted-foreground">Start typing and choose a city, or use your current location.</p>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="text-[11px] font-bold uppercase tracking-wider underline underline-offset-2"
                >
                  Use my location
                </button>
              </div>
              {locationError && <p className="text-[11px] text-destructive mt-1">{locationError}</p>}
              <FieldError msg={errors.location?.message} />
            </div>
          </div>
        </section>

        {/* ── Specs ────────────────────────────────────────────────── */}
        <section className="space-y-5">
          <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">Specs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <FieldLabel>Transmission</FieldLabel>
              <Controller
                name="transmission"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={[...TRANSMISSION_OPTIONS]}
                    placeholder="Select"
                  />
                )}
              />
            </div>
            <div>
              <FieldLabel>Fuel Type</FieldLabel>
              <Controller
                name="fuelType"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={[...FUEL_OPTIONS]}
                    placeholder="Select"
                  />
                )}
              />
            </div>
            <div>
              <FieldLabel>Drivetrain</FieldLabel>
              <Controller
                name="driveType"
                control={control}
                render={({ field }) => (
                  <NativeSelect
                    value={field.value || ''}
                    onChange={field.onChange}
                    options={[...DRIVE_OPTIONS]}
                    placeholder="Select"
                  />
                )}
              />
            </div>
          </div>
        </section>

        {/* ── Description ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">Description</h2>
          <p className="text-[12px] text-muted-foreground">
            Describe condition, history, features, and anything a buyer would want to know.
          </p>
          <textarea
            {...register('description')}
            rows={6}
            placeholder="e.g. One owner vehicle, always garaged. New tires in 2024, clean title, no accidents. Full service history available. Selling due to upgrade..."
            className="w-full px-4 py-3 text-[13px] leading-relaxed border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors resize-y rounded-md"
          />
          <FieldError msg={errors.description?.message} />
        </section>

        {/* ── Submit ───────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-border space-y-3">
          {images.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-[12px] text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Add at least one photo before publishing.
            </div>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || images.length === 0}
            className="w-full h-12 text-[13px] font-bold uppercase tracking-widest"
          >
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Publishing…</>
              : 'Publish Vehicle Listing'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            By listing, you agree to Kerodex's <a href="/terms" className="underline underline-offset-2">Terms of Service</a>.
            Your listing will be live immediately.
          </p>
        </div>
      </form>
    </div>
  );
}
