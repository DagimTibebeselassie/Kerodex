import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button, toast } from '@/components/ui';
import { MAKES, MAKES_MODELS } from '@/data/makes-models';
import { createUploadUrl, createVehicle, createVehiclePresenceCode, getVehicle, updateVehicle } from '@/lib/api';
import {
  Camera, X, Loader2, Search, BadgeCheck, CheckCircle2,
  MapPin, ChevronDown, AlertCircle, FileText,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEARS: number[] = [];
for (let y = CURRENT_YEAR; y >= 1980; y--) YEARS.push(y);

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Needs Work'] as const;
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'CVT'] as const;
const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric', 'Flex Fuel'] as const;
const DRIVE_OPTIONS = ['FWD', 'RWD', 'AWD', '4WD'] as const;
const TITLE_OPTIONS = ['Clean Title', 'Lienholder / Loan', 'Rebuilt Title', 'Salvage Title', 'Not Sure'] as const;
const ACCIDENT_OPTIONS = ['No accidents reported', 'Minor accident disclosed', 'Major accident disclosed', 'Not sure'] as const;
const OWNER_OPTIONS = ['1 previous owner', '2 previous owners', '3+ previous owners', 'Not sure'] as const;
const FEATURE_OPTIONS = [
  'Apple CarPlay', 'Android Auto', 'Backup Camera', 'Blind Spot Monitoring',
  'Bluetooth', 'Heated Seats', 'Ventilated Seats', 'Leather Interior',
  'Navigation System', 'Panoramic Sunroof', 'Remote Start', 'Keyless Entry',
  'Push-Button Start', 'Adaptive Cruise Control', 'Lane Keep Assist',
  'Parking Sensors', 'Premium Sound System', 'Wireless Charging',
  'Third Row Seating', 'Tow Package', 'Roof Rack', 'All-Wheel Drive',
];
const MAINTENANCE_TYPES = ['Oil Change', 'Brake Work', 'Inspection', 'Tires', 'Battery', 'Repair', 'Recall', 'Other'] as const;
type MaintenanceType = typeof MAINTENANCE_TYPES[number];
type MaintenanceRecord = {
  id: string;
  name: string;
  type: MaintenanceType;
  date: string;
  notes: string;
  document_type?: string;
  documentType?: string;
  file_url?: string;
  fileUrl?: string;
  s3Key?: string;
  document_check_status?: string;
  documentCheckStatus?: string;
  ocr_provider?: string;
  ocrProvider?: string;
  ocr_processed_at?: string;
  ocrProcessedAt?: string;
  matched_keywords?: string[];
  matchedKeywords?: string[];
};
type TitleDocument = Omit<MaintenanceRecord, 'type'> & { type: 'Title' };
type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  notes: string;
};
type UploadedImage = {
  url: string;
  fileUrl: string;
  previewUrl?: string;
  s3Key: string;
  key: string;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: string;
};
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
  vin:          z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/i, 'A valid 17-character VIN is required'),
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
  titleStatus:  z.string().optional(),
  accidentHistory: z.string().optional(),
  ownerCount:   z.string().optional(),
  description:  z.string().min(20, 'Description must be at least 20 characters'),
});
type VehicleForm = z.infer<typeof vehicleSchema>;

// VIN decode is routed through the backend so MarketCheck credentials never reach the browser.
interface VinData {
  make: string; model: string; year: string; trim: string;
  engine: string; fuelType: string; driveType: string; transmission: string;
}

function makeOptionFromDecode(make: string): string {
  const normalized = make.trim().toLowerCase().replace(/\s+/g, '_');
  return MAKES.find((option) => option.toLowerCase() === normalized) || make.trim();
}

async function fetchVin(vin: string): Promise<VinData | null> {
  const r = await fetch(`/api/marketcheck/decode/${encodeURIComponent(vin.trim().toUpperCase())}`);
  const body = await r.json();
  const d = body.vehicle || body;
  if (!r.ok) throw new Error(body.error || body.detail || 'Unable to decode VIN.');
  if (!d || d.ErrorCode === '8' || !d.make) return null;
  return {
    make:         makeOptionFromDecode(d.make || ''),
    model:        d.model        || '',
    year:         d.year         || '',
    trim:         d.trim         || '',
    engine:       d.engine || d.body_type || d.bodyClass || '',
    fuelType:     d.fuel_type || d.fuelType || '',
    driveType:    d.drivetrain || d.driveType || '',
    transmission: d.transmission || '',
  };
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

function inferMaintenanceType(fileName: string): MaintenanceType {
  const text = fileName.toLowerCase();
  if (text.includes('oil')) return 'Oil Change';
  if (text.includes('brake') || text.includes('rotor') || text.includes('pad')) return 'Brake Work';
  if (text.includes('inspect')) return 'Inspection';
  if (text.includes('tire') || text.includes('wheel')) return 'Tires';
  if (text.includes('battery')) return 'Battery';
  if (text.includes('recall')) return 'Recall';
  if (text.includes('repair') || text.includes('service')) return 'Repair';
  return 'Other';
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
  const editId = typeof searchParams?.edit === 'string' ? searchParams.edit : '';

  const [images, setImages] = useState<string[]>([]);
  const [imageUploads, setImageUploads] = useState<UploadedImage[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listingCoords, setListingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationFocused, setLocationFocused] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');
  const [featureFocused, setFeatureFocused] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [titleDocument, setTitleDocument] = useState<TitleDocument | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [accuracyCertified, setAccuracyCertified] = useState(false);
  const [presenceCode, setPresenceCode] = useState<{ token: string; code: string; generatedAt: string; expiresAt: string } | null>(null);
  const [presencePhoto, setPresencePhoto] = useState<{ url: string; s3Key: string; name: string } | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);

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
    reset,
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
      titleStatus:  '',
      accidentHistory: '',
      ownerCount:   '',
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
  const featureMatches = FEATURE_OPTIONS
    .filter((feature) =>
      feature.toLowerCase().includes(featureInput.trim().toLowerCase()) &&
      !selectedFeatures.some((selected) => selected.toLowerCase() === feature.toLowerCase())
    )
    .slice(0, 7);

  const addFeature = (feature: string) => {
    const clean = feature.trim();
    if (!clean) return;
    setSelectedFeatures((prev) =>
      prev.some((item) => item.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, clean]
    );
    setFeatureInput('');
    setFeatureFocused(true);
  };

  const removeFeature = (feature: string) => {
    setSelectedFeatures((prev) => prev.filter((item) => item !== feature));
  };

  useEffect(() => {
    if (!editId || !user) return;
    let active = true;
    setEditLoading(true);
    getVehicle(editId)
      .then((vehicle: any) => {
        if (!active) return;
        if (vehicle.userId && vehicle.userId !== user.id) {
          toast.error('You can only edit your own listings.');
          navigate({ to: '/cockpit' });
          return;
        }
        reset({
          vin: vehicle.vin || '',
          make: vehicle.make || '',
          model: vehicle.model || '',
          year: Number(vehicle.year || CURRENT_YEAR),
          trim: vehicle.trim || '',
          price: Number(vehicle.price || 0),
          mileage: Number(vehicle.mileage || 0),
          location: vehicle.location || '',
          condition: vehicle.condition || 'Good',
          transmission: vehicle.transmission || 'Automatic',
          fuelType: vehicle.fuelType || 'Gasoline',
          driveType: vehicle.drivetrain || vehicle.driveType || 'AWD',
          titleStatus: vehicle.titleStatus || '',
          accidentHistory: vehicle.accidentHistory || '',
          ownerCount: vehicle.ownerCount || '',
          description: vehicle.description || '',
        });
        setVin(vehicle.vin || '');
        setVinVerified(Boolean(vehicle.marketCheckVin));
        const loadedImages = Array.isArray(vehicle.images) ? vehicle.images : [];
        setImages(loadedImages);
        const uploads = Array.isArray((vehicle as any).imageUploads)
          ? (vehicle as any).imageUploads
          : loadedImages.map((url: string, index: number) => ({
              url,
              fileUrl: url,
              s3Key: Array.isArray((vehicle as any).imageS3Keys) ? ((vehicle as any).imageS3Keys[index] || '') : '',
              key: Array.isArray((vehicle as any).imageS3Keys) ? ((vehicle as any).imageS3Keys[index] || '') : '',
              name: '',
              contentType: '',
              size: 0,
              uploadedAt: vehicle.updatedAt || new Date().toISOString(),
            }));
        setImageUploads(uploads);
        setSelectedFeatures(Array.isArray(vehicle.features) ? vehicle.features : []);
        setListingCoords(vehicle.lat && vehicle.lng ? { lat: Number(vehicle.lat), lng: Number(vehicle.lng) } : null);
        const records = Array.isArray(vehicle.maintenanceRecords) && vehicle.maintenanceRecords.length
          ? vehicle.maintenanceRecords
          : (vehicle.maintenanceNames || []).map((name: string) => ({
              id: makeId('mnt'),
              name,
              type: inferMaintenanceType(name),
              date: '',
              notes: '',
            }));
        setMaintenanceRecords(records.map((record: any) => ({
          id: record.id || makeId('mnt'),
          name: record.name || record.fileName || 'Maintenance record',
          type: MAINTENANCE_TYPES.includes(record.type) ? record.type : inferMaintenanceType(record.name || record.fileName || ''),
          date: record.date || '',
          notes: record.notes || '',
          document_type: record.document_type || record.documentType || 'maintenance',
          documentType: record.documentType || record.document_type || 'maintenance',
          file_url: record.file_url || record.fileUrl || '',
          fileUrl: record.fileUrl || record.file_url || '',
          s3Key: record.s3Key || '',
          document_check_status: record.document_check_status || record.documentCheckStatus || 'uploaded',
          documentCheckStatus: record.documentCheckStatus || record.document_check_status || 'uploaded',
          ocr_provider: record.ocr_provider || record.ocrProvider || '',
          ocrProvider: record.ocrProvider || record.ocr_provider || '',
          ocr_processed_at: record.ocr_processed_at || record.ocrProcessedAt || '',
          ocrProcessedAt: record.ocrProcessedAt || record.ocr_processed_at || '',
          matched_keywords: record.matched_keywords || record.matchedKeywords || [],
          matchedKeywords: record.matchedKeywords || record.matched_keywords || [],
        })));
        setTitleDocument(vehicle.titleDocument ? {
          id: vehicle.titleDocument.id || makeId('title'),
          name: vehicle.titleDocument.name || vehicle.titleDocument.fileName || 'Title document',
          type: 'Title',
          date: vehicle.titleDocument.date || '',
          notes: vehicle.titleDocument.notes || '',
          document_type: 'title',
          documentType: 'title',
          file_url: vehicle.titleDocument.file_url || vehicle.titleDocument.fileUrl || '',
          fileUrl: vehicle.titleDocument.fileUrl || vehicle.titleDocument.file_url || '',
          s3Key: vehicle.titleDocument.s3Key || '',
          document_check_status: vehicle.titleDocument.document_check_status || vehicle.titleDocument.documentCheckStatus || 'title_uploaded',
          documentCheckStatus: vehicle.titleDocument.documentCheckStatus || vehicle.titleDocument.document_check_status || 'title_uploaded',
          ocr_provider: vehicle.titleDocument.ocr_provider || vehicle.titleDocument.ocrProvider || '',
          ocrProvider: vehicle.titleDocument.ocrProvider || vehicle.titleDocument.ocr_provider || '',
          ocr_processed_at: vehicle.titleDocument.ocr_processed_at || vehicle.titleDocument.ocrProcessedAt || '',
          ocrProcessedAt: vehicle.titleDocument.ocrProcessedAt || vehicle.titleDocument.ocr_processed_at || '',
          matched_keywords: vehicle.titleDocument.matched_keywords || vehicle.titleDocument.matchedKeywords || [],
          matchedKeywords: vehicle.titleDocument.matchedKeywords || vehicle.titleDocument.matched_keywords || [],
        } : null);
        setPresenceCode(vehicle.vehiclePresence?.verificationCode || vehicle.vehiclePresence?.verification_code ? {
          token: '',
          code: vehicle.vehiclePresence?.verificationCode || vehicle.vehiclePresence?.verification_code || '',
          generatedAt: vehicle.vehiclePresence?.generatedAt || vehicle.vehiclePresence?.generated_at || '',
          expiresAt: vehicle.vehiclePresence?.expiresAt || vehicle.vehiclePresence?.expires_at || '',
        } : null);
        setPresencePhoto(vehicle.vehiclePresence?.verificationPhotoUrl || vehicle.vehiclePresence?.verification_photo_url ? {
          url: vehicle.vehiclePresence?.verificationPhotoUrl || vehicle.vehiclePresence?.verification_photo_url || '',
          s3Key: vehicle.vehiclePresence?.verificationPhotoS3Key || '',
          name: 'Vehicle presence photo',
        } : null);
        setTimelineEvents((vehicle.historyTimeline || []).map((event: any) => ({
          id: event.id || makeId('hist'),
          date: event.date || '',
          title: event.title || event.label || '',
          notes: event.notes || '',
        })));
        setAccuracyCertified(Boolean(vehicle.listingAccuracyCertifiedAt || vehicle.listingAccuracyCertified));
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : 'Unable to load listing for editing.');
      })
      .finally(() => {
        if (active) setEditLoading(false);
      });
    return () => { active = false; };
  }, [editId, user?.id, reset, navigate]);

  const uploadListingDocument = async (file: File, documentType: 'maintenance' | 'title') => {
    const contentType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    if (!contentType.startsWith('image/') && contentType !== 'application/pdf') {
      throw new Error(`${file.name} must be a PDF or image file.`);
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new Error(`${file.name} is too large (max 15 MB).`);
    }
    const upload = await createUploadUrl(file.name, contentType, {
      purpose: documentType === 'title' ? 'title-document' : 'maintenance-document',
      documentType,
      fileSize: file.size,
    });
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: upload.headers || { 'content-type': contentType },
      body: file,
    });
    if (!response.ok) throw new Error(`S3 upload failed for ${file.name}.`);
    return {
      file_url: upload.publicUrl,
      fileUrl: upload.publicUrl,
      s3Key: upload.key,
    };
  };

  const handleMaintenanceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!user) { login(); return; }
    const records: MaintenanceRecord[] = [];
    for (const file of Array.from(files)) {
      try {
        const upload = await uploadListingDocument(file, 'maintenance');
        records.push({
          id: makeId('mnt'),
          name: file.name,
          type: inferMaintenanceType(file.name),
          date: '',
          notes: '',
          document_type: 'maintenance',
          documentType: 'maintenance',
          document_check_status: 'uploaded',
          documentCheckStatus: 'uploaded',
          ...upload,
        });
      } catch (error: any) {
        toast.error(error?.message || `Unable to upload ${file.name}`);
      }
    }
    setMaintenanceRecords((prev) => {
      const seen = new Set(prev.map((item) => item.name.toLowerCase()));
      const next = [...prev];
      records.forEach((record) => {
        if (!seen.has(record.name.toLowerCase())) next.push(record);
      });
      return next.slice(0, 12);
    });
  };

  const handleTitleDocumentFile = async (file: File | null) => {
    if (!file) return;
    if (!user) { login(); return; }
    try {
      const upload = await uploadListingDocument(file, 'title');
      setTitleDocument({
        id: makeId('title'),
        name: file.name,
        type: 'Title',
        date: '',
        notes: '',
        document_type: 'title',
        documentType: 'title',
        document_check_status: 'title_uploaded',
        documentCheckStatus: 'title_uploaded',
        ...upload,
      });
      toast.success('Title document uploaded for automated document check.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to upload title document.');
    }
  };

  const generatePresenceCode = async () => {
    if (!user) { login(); return; }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin.trim().toUpperCase())) {
      setVinError('Enter a valid 17-character VIN before generating a verification code.');
      toast.error('VIN is required for windshield VIN/code verification.');
      return;
    }
    setPresenceLoading(true);
    try {
      const code = await createVehiclePresenceCode();
      setPresenceCode(code);
      setPresencePhoto(null);
      toast.success(`Verification code generated: ${code.code}`);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to generate verification code.');
    } finally {
      setPresenceLoading(false);
    }
  };

  const handlePresencePhotoFile = async (file: File | null) => {
    if (!file) return;
    if (!user) { login(); return; }
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin.trim().toUpperCase())) {
      setVinError('Enter a valid 17-character VIN before uploading the verification photo.');
      toast.error('VIN is required so Kerodex can compare it against the photo.');
      return;
    }
    if (!presenceCode) {
      toast.error('Generate a verification code first.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Upload an image showing the windshield VIN and verification code.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} is too large (max 10 MB).`);
      return;
    }
    setPresenceLoading(true);
    try {
      const upload = await createUploadUrl(file.name, file.type, { purpose: 'vehicle-presence', fileSize: file.size });
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers || { 'content-type': file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`S3 upload failed for ${file.name}.`);
      const proof = { url: upload.publicUrl, s3Key: upload.key };
      setPresencePhoto({ ...proof, name: file.name });
      toast.success('Vehicle presence photo uploaded.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to upload vehicle presence photo.');
    } finally {
      setPresenceLoading(false);
    }
  };

  const updateMaintenanceRecord = (id: string, patch: Partial<MaintenanceRecord>) => {
    setMaintenanceRecords((prev) => prev.map((record) => record.id === id ? { ...record, ...patch } : record));
  };

  const addTimelineEvent = () => {
    setTimelineEvents((prev) => [...prev, { id: makeId('hist'), date: '', title: '', notes: '' }].slice(0, 12));
  };

  const updateTimelineEvent = (id: string, patch: Partial<TimelineEvent>) => {
    setTimelineEvents((prev) => prev.map((event) => event.id === id ? { ...event, ...patch } : event));
  };

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
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
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
    let data: VinData | null = null;
    try {
      data = await fetchVin(cleaned);
    } catch (error: any) {
      setVinLoading(false);
      setVinError(error?.message || 'Unable to decode this VIN.');
      return;
    }
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
    if (data.driveType && DRIVE_OPTIONS.includes(data.driveType as any))
      setValue('driveType', data.driveType, { shouldDirty: true });

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
      const previewUrl = URL.createObjectURL(file);
      try {
        const upload = await createUploadUrl(file.name, file.type, { purpose: 'listing-photo', fileSize: file.size });
        const response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: upload.headers || { 'content-type': file.type },
          body: file,
        });
        if (!response.ok) throw new Error(`S3 upload failed for ${file.name}.`);
        const url = upload.publicUrl;
        setImages((prev) => [...prev, previewUrl]);
        setImageUploads((prev) => [...prev, {
          url,
          fileUrl: url,
          previewUrl,
          s3Key: upload.key,
          key: upload.key,
          name: file.name,
          contentType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        }]);
      } catch (err: any) {
        URL.revokeObjectURL(previewUrl);
        console.error('Upload error:', err);
        toast.error(err?.message || 'Image upload failed. Make sure S3 is configured and try again.');
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
    const cleanVin = vin.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin)) {
      setVinError('A valid 17-character VIN is required before submitting.');
      toast.error('VIN is required for vehicle presence verification.');
      return;
    }
    if (images.length === 0) {
      toast.error('Please add at least one photo of your vehicle.');
      return;
    }
    if (!accuracyCertified) {
      toast.error('Certify that the listing is accurate before publishing.');
      return;
    }
    if (!editId && (!presenceCode?.token || !presenceCode.code || !presencePhoto?.url)) {
      toast.error('Complete the vehicle presence photo challenge before submitting.');
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

      const payload = {
        userId:      user.id,
        vin:         cleanVin,
        make:        data.make,
        model:       data.model,
        trim:        data.trim || undefined,
        year:        data.year,
        price:       data.price,
        mileage:     data.mileage,
        location,
        lat:         coords?.lat,
        lng:         coords?.lng,
        transmission: data.transmission,
        fuelType:    data.fuelType,
        drivetrain:  data.driveType,
        condition:   data.condition,
        titleStatus: data.titleStatus,
        accidentHistory: data.accidentHistory,
        ownerCount:  data.ownerCount,
        features:    selectedFeatures,
        maintenanceRecords: maintenanceRecords.map((record) => ({
          ...record,
          type: record.type || inferMaintenanceType(record.name),
          document_type: record.document_type || 'maintenance',
          documentType: record.documentType || 'maintenance',
          document_check_status: record.document_check_status || record.documentCheckStatus || 'uploaded',
          documentCheckStatus: record.documentCheckStatus || record.document_check_status || 'uploaded',
        })),
        titleDocument: titleDocument ? {
          ...titleDocument,
          document_type: 'title',
          documentType: 'title',
          document_check_status: titleDocument.document_check_status || titleDocument.documentCheckStatus || 'title_uploaded',
          documentCheckStatus: titleDocument.documentCheckStatus || titleDocument.document_check_status || 'title_uploaded',
        } : null,
        maintenanceNames: maintenanceRecords.map((record) => record.name),
        historyTimeline: timelineEvents
          .filter((event) => event.title.trim() || event.notes.trim() || event.date)
          .map((event) => ({
            id: event.id,
            date: event.date,
            title: event.title.trim(),
            notes: event.notes.trim(),
          })),
        description: data.description,
        images: imageUploads.length ? imageUploads.map((item) => item.fileUrl || item.url).filter(Boolean) : images,
        imageUploads,
        imageS3Keys: imageUploads.map((item) => item.s3Key).filter(Boolean),
        status:      'available',
        vehiclePresenceToken: presenceCode?.token,
        vehiclePresenceCode: presenceCode?.code,
        vehiclePresenceGeneratedAt: presenceCode?.generatedAt,
        vehiclePresenceExpiresAt: presenceCode?.expiresAt,
        vehiclePresencePhotoUrl: presencePhoto?.url,
        vehiclePresenceS3Key: presencePhoto?.s3Key,
        listingAccuracyCertified: true,
        listingAccuracyVersion: 'v1.0',
        listingAccuracyCertifiedAt: new Date().toISOString(),
      };

      const vehicle = editId
        ? await updateVehicle(editId, payload)
        : await createVehicle(payload);

      toast.success(editId ? 'Listing updated successfully!' : 'Your listing has been submitted. Vehicle verification is currently being processed.');
      navigate({ to: '/vehicle/$id', params: { id: vehicle.id } });
    } catch (err) {
      console.error('Create listing error:', err);
      toast.error('Failed to create listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Auth gate ─────────────────────────────────────────────────────────
  if (authLoading || editLoading) {
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
        <h1 className="text-3xl font-black tracking-tight mb-2">{editId ? 'Edit Your Vehicle' : 'List Your Vehicle'}</h1>
        <p className="text-[13px] text-muted-foreground">
          {editId ? 'Update the saved listing details below.' : 'Fill out the form below. Use VIN autofill to save time.'}
        </p>
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
              <ImageItem
                key={i}
                url={url}
                onRemove={() => {
                  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
                  setImages((prev) => prev.filter((_, idx) => idx !== i));
                  setImageUploads((prev) => prev.filter((_, idx) => idx !== i));
                }}
              />
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

        <section className="space-y-4">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-[0.15em] mb-1">Vehicle Presence Verification</h2>
            <p className="text-[12px] text-muted-foreground">
              Write the code on paper, hold it next to the VIN visible through the windshield, then upload a clear photo showing both the windshield VIN and the code.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Verification Code</div>
                <div className="mt-1 text-2xl font-black tracking-[0.18em]">
                  {presenceCode?.code || 'Not generated'}
                </div>
                {presenceCode?.expiresAt && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Expires {new Date(presenceCode.expiresAt).toLocaleString()}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={generatePresenceCode}
                disabled={presenceLoading}
                className="h-10 px-5 text-[11px] font-bold uppercase tracking-widest"
              >
                {presenceLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-2" />}
                {presenceCode ? 'New Code' : 'Generate Code'}
              </Button>
            </div>
            <label className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-background px-4 py-6 text-center transition-colors ${presenceCode ? 'hover:bg-muted/30' : 'opacity-60 pointer-events-none'}`}>
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-[12px] font-bold uppercase tracking-widest">
                {presencePhoto ? presencePhoto.name : 'Upload Verification Photo'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                This photo is used for VIN/code verification and does not become a public gallery photo.
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!presenceCode || presenceLoading}
                onChange={(e) => {
                  handlePresencePhotoFile(e.target.files?.[0] || null);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            {presencePhoto ? (
              <p className="text-[11px] text-primary font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verification photo uploaded. Your listing will be processed after submission.
              </p>
            ) : (
              <p className="text-[11px] text-amber-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Required before the listing can be submitted.
              </p>
            )}
          </div>
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
                    onChange={(value) => {
                      field.onChange(value);
                      setValue('model', '', { shouldDirty: true });
                    }}
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
        <section className="space-y-5">
          <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">History & Title</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <FieldLabel>Title Status</FieldLabel>
              <Controller
                name="titleStatus"
                control={control}
                render={({ field }) => (
                  <NativeSelect value={field.value || ''} onChange={field.onChange} options={[...TITLE_OPTIONS]} placeholder="Select" />
                )}
              />
            </div>
            <div>
              <FieldLabel>Accident History</FieldLabel>
              <Controller
                name="accidentHistory"
                control={control}
                render={({ field }) => (
                  <NativeSelect value={field.value || ''} onChange={field.onChange} options={[...ACCIDENT_OPTIONS]} placeholder="Select" />
                )}
              />
            </div>
            <div>
              <FieldLabel>Ownership History</FieldLabel>
              <Controller
                name="ownerCount"
                control={control}
                render={({ field }) => (
                  <NativeSelect value={field.value || ''} onChange={field.onChange} options={[...OWNER_OPTIONS]} placeholder="Select" />
                )}
              />
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-[12px] font-bold uppercase tracking-widest">Title Document</div>
                <p className="text-[11px] text-muted-foreground">
                  Optional. Upload a PDF or image so Kerodex can check whether the VIN appears to match this listing.
                </p>
                {titleDocument && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{titleDocument.name}</span>
                    <span className="text-muted-foreground">{titleDocument.documentCheckStatus || titleDocument.document_check_status}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {titleDocument && (
                  <button
                    type="button"
                    onClick={() => setTitleDocument(null)}
                    className="h-9 px-3 text-[11px] font-bold uppercase tracking-widest border border-border rounded-md hover:bg-background"
                  >
                    Remove
                  </button>
                )}
                <label className="h-9 px-3 inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-background text-[11px] font-bold uppercase tracking-widest hover:bg-muted/40">
                  Upload Title
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      handleTitleDocumentFile(e.target.files?.[0] || null);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">Features</h2>
            <p className="text-[12px] text-muted-foreground">Add equipment buyers care about. Choose suggestions or type your own.</p>
          </div>
          <div className="relative">
            <input
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onFocus={() => setFeatureFocused(true)}
              onBlur={() => setTimeout(() => setFeatureFocused(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addFeature(featureMatches[0] || featureInput);
                }
              }}
              placeholder="Start typing a feature, like Apple CarPlay"
              className="w-full h-10 px-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
            />
            {featureFocused && (featureInput.trim() || featureMatches.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 border border-border bg-background shadow-lg rounded-md overflow-hidden">
                {featureMatches.length ? featureMatches.map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addFeature(feature)}
                    className="w-full h-10 px-3 text-left text-[13px] hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {feature}
                  </button>
                )) : (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addFeature(featureInput)}
                    className="w-full h-10 px-3 text-left text-[13px] hover:bg-muted transition-colors"
                  >
                    Add "{featureInput.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
          {selectedFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFeatures.map((feature) => (
                <span key={feature} className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-border bg-muted/30 text-[12px] font-medium">
                  {feature}
                  <button type="button" onClick={() => removeFeature(feature)} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${feature}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">Maintenance Documents</h2>
            <p className="text-[12px] text-muted-foreground">Upload service records, inspection reports, tire receipts, or repair invoices.</p>
          </div>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center hover:bg-muted/30 transition-colors">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-[12px] font-bold uppercase tracking-widest">Upload Records</span>
            <span className="text-[11px] text-muted-foreground">PDF or image files up to 15 MB each</span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                handleMaintenanceFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </label>
          {maintenanceRecords.length > 0 && (
            <div className="space-y-2">
              {maintenanceRecords.map((record) => (
                <div key={record.id} className="space-y-3 border border-border bg-background px-3 py-3 rounded-md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-[12px] font-medium">{record.name}</span>
                    </div>
                    <button type="button" onClick={() => setMaintenanceRecords((prev) => prev.filter((item) => item.id !== record.id))} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${record.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <NativeSelect
                      value={record.type}
                      onChange={(value) => updateMaintenanceRecord(record.id, { type: value as MaintenanceType })}
                      options={[...MAINTENANCE_TYPES]}
                    />
                    <input
                      type="month"
                      value={record.date}
                      onChange={(e) => updateMaintenanceRecord(record.id, { date: e.target.value })}
                      className="h-10 px-3 text-[13px] border border-input bg-background text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                    />
                    <input
                      value={record.notes}
                      onChange={(e) => updateMaintenanceRecord(record.id, { notes: e.target.value })}
                      placeholder="Optional note"
                      className="h-10 px-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">Vehicle Timeline</h2>
            <p className="text-[12px] text-muted-foreground">Add major history events buyers should know about, like tires, brakes, ownership changes, or repairs.</p>
          </div>
          <div className="space-y-3">
            {timelineEvents.map((event) => (
              <div key={event.id} className="space-y-3 border border-border bg-background p-3 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Timeline Event</span>
                  <button type="button" onClick={() => setTimelineEvents((prev) => prev.filter((item) => item.id !== event.id))} className="text-muted-foreground hover:text-foreground" aria-label="Remove timeline event">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="month"
                    value={event.date}
                    onChange={(e) => updateTimelineEvent(event.id, { date: e.target.value })}
                    className="h-10 px-3 text-[13px] border border-input bg-background text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                  />
                  <input
                    value={event.title}
                    onChange={(e) => updateTimelineEvent(event.id, { title: e.target.value })}
                    placeholder="Event title"
                    className="h-10 px-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                  />
                  <input
                    value={event.notes}
                    onChange={(e) => updateTimelineEvent(event.id, { notes: e.target.value })}
                    placeholder="Optional detail"
                    className="h-10 px-3 text-[13px] border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors rounded-md"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addTimelineEvent} className="h-10 px-4 text-[11px] font-bold uppercase tracking-wider">
            Add Timeline Event
          </Button>
        </section>

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
          <label className="flex items-start gap-3 p-3 border border-border bg-muted/20 rounded-md text-[12px] text-muted-foreground leading-relaxed">
            <input
              type="checkbox"
              checked={accuracyCertified}
              onChange={(e) => setAccuracyCertified(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-foreground"
              required
            />
            <span>
              I certify that this listing is accurate to the best of my knowledge, including mileage,
              condition, title status, accident history, images, and documents.
            </span>
          </label>
          <Button
            type="submit"
            disabled={isSubmitting || images.length === 0 || !accuracyCertified}
            className="w-full h-12 text-[13px] font-bold uppercase tracking-widest"
          >
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editId ? 'Saving...' : 'Publishing...'}</>
              : editId ? 'Save Listing Changes' : 'Publish Vehicle Listing'}
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
