import { useState, useEffect, useRef, useMemo } from 'react';
import { Vehicle } from '@/types';
import { MAKES, getModelsForMake } from '@/data/makes-models';
import { VehicleCard } from '@/components/VehicleCard';
import { MapView } from '@/components/MapView';
import { listVehicles } from '@/lib/api';
import {
  SlidersHorizontal,
  LayoutGrid,
  Map,
  X,
  ChevronDown,
  Search as SearchIcon,
  Filter,
  BadgeCheck,
  CheckCircle2,
} from 'lucide-react';

const YEARS: number[] = [];
for (let y = 2026; y >= 1990; y--) YEARS.push(y);

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Convertible', 'Van', 'Wagon'] as const;
const FUEL_TYPES    = ['Gas', 'Hybrid', 'EV', 'Diesel', 'Plug-in Hybrid'] as const;
const DRIVE_TYPES   = ['FWD', 'AWD', 'RWD', '4WD'] as const;
const EXTERIOR_COLORS = ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Green', 'Brown', 'Gold'] as const;

const MILEAGE_OPTIONS = [
  { label: 'Any',          value: '' },
  { label: 'Under 25k mi', value: '25000' },
  { label: 'Under 50k mi', value: '50000' },
  { label: 'Under 75k mi', value: '75000' },
  { label: 'Under 100k mi', value: '100000' },
  { label: 'Under 150k mi', value: '150000' },
] as const;

const RADIUS_OPTIONS = [
  { label: '10 mi',       value: '10' },
  { label: '25 mi',       value: '25' },
  { label: '50 mi',       value: '50' },
  { label: '100 mi',      value: '100' },
  { label: '250 mi',      value: '250' },
  { label: 'Unlimited',   value: '' },
] as const;

const SORT_OPTIONS = [
  { label: 'Recommended',       value: 'recommended' },
  { label: 'Closest first',     value: 'closest' },
  { label: 'Newest listings',   value: 'newest' },
  { label: 'Lowest price',      value: 'price_asc' },
  { label: 'Highest price',     value: 'price_desc' },
  { label: 'Lowest mileage',    value: 'mileage_asc' },
  { label: 'Best deal',         value: 'best_deal' },
  { label: 'Highest trust score', value: 'trust_score' },
  { label: 'Fastest response',  value: 'response_time' },
];

const DEFAULT_SEARCH_LOCATION = { lat: 33.749, lng: -84.388 };

interface FilterState {
  priceMin: string;
  priceMax: string;
  make: string;
  model: string;
  yearMin: string;
  yearMax: string;
  mileageMax: string;
  radius: string;
  vehicleTypes: string[];
  fuelTypes: string[];
  driveTypes: string[];
  transmission: string;
  exteriorColor: string;
  cleanTitle: boolean;
  noAccidents: boolean;
  numOwners: string;
  verifiedSeller: boolean;
  ownershipVerified: boolean;
  vehicleVerified: boolean;
  inspectionVerified: boolean;
  belowMarket: boolean;
  hasMaintenanceRecords: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  priceMin: '', priceMax: '',
  make: '', model: '',
  yearMin: '', yearMax: '',
  mileageMax: '',
  radius: '',
  vehicleTypes: [],
  fuelTypes: [],
  driveTypes: [],
  transmission: '',
  exteriorColor: '',
  cleanTitle: false,
  noAccidents: false,
  numOwners: '',
  verifiedSeller: false,
  ownershipVerified: false,
  vehicleVerified: false,
  inspectionVerified: false,
  belowMarket: false,
  hasMaintenanceRecords: false,
};

function countFilters(f: FilterState): number {
  let n = 0;
  if (f.priceMin || f.priceMax)      n++;
  if (f.make)                         n++;
  if (f.model)                        n++;
  if (f.yearMin || f.yearMax)         n++;
  if (f.mileageMax)                   n++;
  if (f.radius)                       n++;
  if (f.vehicleTypes.length)          n += f.vehicleTypes.length;
  if (f.fuelTypes.length)             n += f.fuelTypes.length;
  if (f.driveTypes.length)            n += f.driveTypes.length;
  if (f.transmission)                 n++;
  if (f.exteriorColor)                n++;
  if (f.cleanTitle)                   n++;
  if (f.noAccidents)                  n++;
  if (f.numOwners)                    n++;
  if (f.verifiedSeller)               n++;
  if (f.ownershipVerified)            n++;
  if (f.vehicleVerified)              n++;
  if (f.inspectionVerified)           n++;
  if (f.belowMarket)                  n++;
  if (f.hasMaintenanceRecords)        n++;
  return n;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function vehicleText(vehicle: Vehicle): string {
  return [
    vehicle.title,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.location,
    vehicle.description,
    vehicle.bodyType,
    vehicle.fuelType,
    vehicle.drivetrain,
    vehicle.titleStatus,
    vehicle.accidentHistory,
    vehicle.ownerCount,
    vehicle.seller?.name,
    ...(vehicle.badges || []),
    ...(vehicle.features || []),
    ...(vehicle.historyHighlights || []),
    ...(vehicle.maintenanceNames || []),
  ].map(normalized).join(' ');
}

function matchesAny(value: unknown, options: string[]): boolean {
  const text = normalized(value);
  return options.some((option) => {
    const wanted = normalized(option);
    if (!wanted) return true;
    if (wanted === 'gas') return text.includes('gas') || text.includes('gasoline');
    if (wanted === 'ev') return text.includes('ev') || text.includes('electric');
    if (wanted === '4wd') return text.includes('4wd') || text.includes('4x4') || text.includes('four wheel');
    return text.includes(wanted);
  });
}

function isVerifiedSeller(vehicle: Vehicle): boolean {
  const text = vehicleText(vehicle);
  return Boolean(vehicle.seller?.verified) || text.includes('verified seller') || text.includes('identity verified');
}

function hasOwnershipVerified(vehicle: Vehicle): boolean {
  const text = vehicleText(vehicle);
  return (text.includes('ownership') || text.includes('owner document')) && !text.includes('ownership pending');
}

function hasVehicleVerified(vehicle: Vehicle): boolean {
  const text = vehicleText(vehicle);
  return Boolean((vehicle as any).vin || vehicle.marketCheckVin) || text.includes('vehicle verified') || text.includes('vin decoded') || text.includes('vin verified');
}

function hasInspectionVerified(vehicle: Vehicle): boolean {
  const text = vehicleText(vehicle);
  return text.includes('inspection verified') || text.includes('inspection complete');
}

function hasCleanTitle(vehicle: Vehicle): boolean {
  const title = normalized(vehicle.titleStatus);
  return title.includes('clean') || vehicleText(vehicle).includes('clean title');
}

function hasNoAccidents(vehicle: Vehicle): boolean {
  const history = normalized(vehicle.accidentHistory);
  return history.includes('no accident') || vehicleText(vehicle).includes('no accidents');
}

function hasMaintenanceRecords(vehicle: Vehicle): boolean {
  const text = vehicleText(vehicle);
  return Boolean(vehicle.maintenanceNames?.length) || text.includes('maintenance record') || text.includes('service record');
}

function matchesOwnerCount(vehicle: Vehicle, ownerFilter: string): boolean {
  const owners = normalized(vehicle.ownerCount);
  if (!ownerFilter) return true;
  if (ownerFilter === '3+') return owners.includes('3') || owners.includes('4') || owners.includes('5') || owners.includes('+');
  return owners.includes(ownerFilter);
}

function isBelowMarket(vehicle: Vehicle): boolean {
  const fairValueDelta = Number((vehicle as any).fairValueDelta);
  if (Number.isFinite(fairValueDelta) && fairValueDelta < 0) return true;
  const marketValue = Number(vehicle.marketValue);
  return Number.isFinite(marketValue) && marketValue > 0 && vehicle.price < marketValue;
}

function trustScore(vehicle: Vehicle): number {
  const explicit = Number((vehicle as any).trustScore);
  if (Number.isFinite(explicit)) return explicit;
  let score = 45;
  if (isVerifiedSeller(vehicle)) score += 20;
  if (hasOwnershipVerified(vehicle)) score += 12;
  if (hasVehicleVerified(vehicle)) score += 10;
  if (hasInspectionVerified(vehicle)) score += 8;
  if (hasMaintenanceRecords(vehicle)) score += 5;
  return score;
}

function dealScore(vehicle: Vehicle): number {
  const explicit = Number((vehicle as any).dealScore);
  if (Number.isFinite(explicit)) return explicit;
  const fairValueDelta = Number((vehicle as any).fairValueDelta);
  if (Number.isFinite(fairValueDelta)) return Math.max(0, 100 - Math.max(0, fairValueDelta / 250));
  return isBelowMarket(vehicle) ? 80 : 60;
}

function responseSpeed(vehicle: Vehicle): number {
  const response = normalized(vehicle.seller?.responseTime);
  if (!response) return 99;
  if (response.includes('minute')) return 0;
  if (response.includes('hour')) return 1;
  if (response.includes('same day')) return 2;
  if (response.includes('day')) return 3;
  return 10;
}

function applyFilters(vehicles: Vehicle[], f: FilterState, search: string): Vehicle[] {
  return vehicles.filter((v) => {
    if (search) {
      const q = normalized(search);
      if (!vehicleText(v).includes(q)) return false;
    }
    if (f.priceMin && v.price < Number(f.priceMin)) return false;
    if (f.priceMax && v.price > Number(f.priceMax)) return false;
    if (f.make && v.make !== f.make) return false;
    if (f.model && v.model !== f.model) return false;
    if (f.yearMin && v.year < Number(f.yearMin)) return false;
    if (f.yearMax && v.year > Number(f.yearMax)) return false;
    if (f.mileageMax && v.mileage > Number(f.mileageMax)) return false;
    if (f.vehicleTypes.length && !matchesAny(v.bodyType, f.vehicleTypes)) return false;
    if (f.fuelTypes.length && !matchesAny(v.fuelType, f.fuelTypes)) return false;
    if (f.driveTypes.length && !matchesAny(`${v.drivetrain || ''} ${(v.features || []).join(' ')}`, f.driveTypes)) return false;
    if (f.transmission && !normalized(v.transmission).includes(normalized(f.transmission))) return false;
    if (f.exteriorColor && !matchesAny((v as any).exteriorColor || (v as any).color || vehicleText(v), [f.exteriorColor])) return false;
    if (f.cleanTitle && !hasCleanTitle(v)) return false;
    if (f.noAccidents && !hasNoAccidents(v)) return false;
    if (f.numOwners && !matchesOwnerCount(v, f.numOwners)) return false;
    if (f.verifiedSeller && !isVerifiedSeller(v)) return false;
    if (f.ownershipVerified && !hasOwnershipVerified(v)) return false;
    if (f.vehicleVerified && !hasVehicleVerified(v)) return false;
    if (f.inspectionVerified && !hasInspectionVerified(v)) return false;
    if (f.belowMarket && !isBelowMarket(v)) return false;
    if (f.hasMaintenanceRecords && !hasMaintenanceRecords(v)) return false;
    return true;
  });
}

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function vehiclePoint(vehicle: Vehicle) {
  const lat = Number((vehicle as any).lat);
  const lng = Number((vehicle as any).lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function applyLocationFilter(vehicles: Vehicle[], userLocation: { lat: number; lng: number } | null, radius: string): Vehicle[] {
  const miles = Number(radius);
  if (!userLocation || !Number.isFinite(miles) || miles <= 0) return vehicles;
  return vehicles.filter((vehicle) => {
    const point = vehiclePoint(vehicle);
    return point ? distanceMiles(userLocation, point) <= miles : false;
  });
}

function applySort(vehicles: Vehicle[], sortBy: string, userLocation: { lat: number; lng: number } | null): Vehicle[] {
  return [...vehicles].sort((a, b) => {
    switch (sortBy) {
      case 'recommended': return dealScore(b) - dealScore(a) || trustScore(b) - trustScore(a) || b.createdAt.localeCompare(a.createdAt);
      case 'price_asc':    return a.price - b.price;
      case 'price_desc':   return b.price - a.price;
      case 'mileage_asc':  return a.mileage - b.mileage;
      case 'newest':       return b.createdAt.localeCompare(a.createdAt);
      case 'best_deal': {
        const aDelta = Number((a as any).fairValueDelta);
        const bDelta = Number((b as any).fairValueDelta);
        const aDeal = Number.isFinite(aDelta) ? aDelta : a.price - Number(a.marketValue || a.price);
        const bDeal = Number.isFinite(bDelta) ? bDelta : b.price - Number(b.marketValue || b.price);
        return aDeal - bDeal;
      }
      case 'trust_score': return trustScore(b) - trustScore(a);
      case 'response_time': return responseSpeed(a) - responseSpeed(b);
      case 'closest': {
        if (!userLocation) return 0;
        const aPoint = vehiclePoint(a);
        const bPoint = vehiclePoint(b);
        if (!aPoint || !bPoint) return !aPoint && bPoint ? 1 : aPoint && !bPoint ? -1 : 0;
        return distanceMiles(userLocation, aPoint) - distanceMiles(userLocation, bPoint);
      }
      default:             return 0;
    }
  });
}

const INPUT_CLS   = 'w-full h-9 border border-border bg-background text-foreground text-[12px] px-2.5 outline-none focus:border-ring placeholder:text-muted-foreground transition-colors';
const SELECT_CLS  = `${INPUT_CLS} appearance-none cursor-pointer`;
const SECTION_LBL = 'text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2';
const CHIP_CLS    = 'inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-[11px] font-medium bg-background';

function CheckboxItem({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary cursor-pointer"
      />
      <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors select-none">{label}</span>
    </label>
  );
}

function FilterSidebarContent({
  filters, setFilters, onClear,
}: { filters: FilterState; setFilters: (f: FilterState) => void; onClear: () => void }) {
  const modelOptions = filters.make ? getModelsForMake(filters.make) : [];

  const toggleSet = (key: 'vehicleTypes' | 'fuelTypes' | 'driveTypes', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-1.5 text-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </h2>
        <button onClick={onClear} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          Clear all
        </button>
      </div>

      <div className="kerodex-scrollbar-hidden flex-1 min-h-0 overflow-y-auto space-y-5 pr-0.5">

        {/* 1. Price Range */}
        <div>
          <p className={SECTION_LBL}>Price Range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">$</span>
              <input type="number" placeholder="Min" min={0} value={filters.priceMin}
                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                className={`${INPUT_CLS} pl-5`} />
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">$</span>
              <input type="number" placeholder="Max" min={0} value={filters.priceMax}
                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                className={`${INPUT_CLS} pl-5`} />
            </div>
          </div>
          <div className="mt-2">
            <CheckboxItem id="f-below-market" label="Below market only" checked={filters.belowMarket} onChange={(v) => setFilters({ ...filters, belowMarket: v })} />
          </div>
        </div>

        {/* 2. Make */}
        <div>
          <p className={SECTION_LBL}>Make</p>
          <div className="relative">
            <select value={filters.make} onChange={(e) => setFilters({ ...filters, make: e.target.value, model: '' })} className={SELECT_CLS}>
              <option value="">Any Make</option>
              {MAKES.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* 3. Model */}
        <div>
          <p className={SECTION_LBL}>Model</p>
          <div className="relative">
            <select value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value })} className={SELECT_CLS} disabled={!filters.make}>
              <option value="">{filters.make ? 'Any Model' : 'Select make first'}</option>
              {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* 4. Year Range */}
        <div>
          <p className={SECTION_LBL}>Year Range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <select value={filters.yearMin} onChange={(e) => setFilters({ ...filters, yearMin: e.target.value })} className={SELECT_CLS}>
                <option value="">From</option>
                {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            </div>
            <div className="relative">
              <select value={filters.yearMax} onChange={(e) => setFilters({ ...filters, yearMax: e.target.value })} className={SELECT_CLS}>
                <option value="">To</option>
                {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* 5. Mileage */}
        <div>
          <p className={SECTION_LBL}>Mileage</p>
          <div className="relative">
            <select value={filters.mileageMax} onChange={(e) => setFilters({ ...filters, mileageMax: e.target.value })} className={SELECT_CLS}>
              {MILEAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* 6. Distance Radius */}
        <div>
          <p className={SECTION_LBL}>Distance Radius</p>
          <div className="relative">
            <select value={filters.radius} onChange={(e) => setFilters({ ...filters, radius: e.target.value })} className={SELECT_CLS}>
              {RADIUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* 7. Vehicle Type */}
        <div>
          <p className={SECTION_LBL}>Vehicle Type</p>
          <div className="space-y-2">
            {VEHICLE_TYPES.map((t) => (
              <CheckboxItem key={t} id={`ft-${t}`} label={t}
                checked={filters.vehicleTypes.includes(t)}
                onChange={() => toggleSet('vehicleTypes', t)} />
            ))}
          </div>
        </div>

        {/* 8. Fuel Type */}
        <div>
          <p className={SECTION_LBL}>Fuel Type</p>
          <div className="space-y-2">
            {FUEL_TYPES.map((f) => (
              <CheckboxItem key={f} id={`ff-${f}`} label={f}
                checked={filters.fuelTypes.includes(f)}
                onChange={() => toggleSet('fuelTypes', f)} />
            ))}
          </div>
        </div>

        {/* 9. Drivetrain */}
        <div>
          <p className={SECTION_LBL}>Drivetrain</p>
          <div className="space-y-2">
            {DRIVE_TYPES.map((d) => (
              <CheckboxItem key={d} id={`fd-${d}`} label={d}
                checked={filters.driveTypes.includes(d)}
                onChange={() => toggleSet('driveTypes', d)} />
            ))}
          </div>
        </div>

        {/* 10. Transmission */}
        <div>
          <p className={SECTION_LBL}>Transmission</p>
          <div className="relative">
            <select value={filters.transmission} onChange={(e) => setFilters({ ...filters, transmission: e.target.value })} className={SELECT_CLS}>
              <option value="">Any</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
              <option value="cvt">CVT</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* 11. Trust Filters */}
        <div>
          <p className={SECTION_LBL}>Exterior Color</p>
          <div className="relative">
            <select value={filters.exteriorColor} onChange={(e) => setFilters({ ...filters, exteriorColor: e.target.value })} className={SELECT_CLS}>
              <option value="">Any color</option>
              {EXTERIOR_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* 11. Trust Filters */}
        <div>
          <p className={SECTION_LBL}>Trust Filters</p>
          <div className="space-y-2">
            <CheckboxItem id="f-verified-seller" label="Verified Seller" checked={filters.verifiedSeller} onChange={(v) => setFilters({ ...filters, verifiedSeller: v })} />
            <CheckboxItem id="f-ownership" label="Ownership documents reviewed" checked={filters.ownershipVerified} onChange={(v) => setFilters({ ...filters, ownershipVerified: v })} />
            <CheckboxItem id="f-vehicle-ver" label="Vehicle Verified" checked={filters.vehicleVerified} onChange={(v) => setFilters({ ...filters, vehicleVerified: v })} />
            <CheckboxItem id="f-inspection" label="Inspection Verified" checked={filters.inspectionVerified} onChange={(v) => setFilters({ ...filters, inspectionVerified: v })} />
          </div>
        </div>

        {/* 12. History */}
        <div>
          <p className={SECTION_LBL}>History</p>
          <div className="space-y-2">
            <CheckboxItem id="f-clean-title" label="Clean title only" checked={filters.cleanTitle} onChange={(v) => setFilters({ ...filters, cleanTitle: v })} />
            <CheckboxItem id="f-no-accidents" label="No accidents" checked={filters.noAccidents} onChange={(v) => setFilters({ ...filters, noAccidents: v })} />
            <CheckboxItem id="f-maint-records" label="Has maintenance records" checked={filters.hasMaintenanceRecords} onChange={(v) => setFilters({ ...filters, hasMaintenanceRecords: v })} />
          </div>
        </div>

        {/* 13. Owners */}
        <div>
          <p className={SECTION_LBL}>Owners</p>
          <div className="relative">
            <select value={filters.numOwners} onChange={(e) => setFilters({ ...filters, numOwners: e.target.value })} className={SELECT_CLS}>
              <option value="">Any</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3+">3+</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

      </div>
    </div>
  );
}

function MapListCard({ vehicle, isSelected, onClick }: { vehicle: Vehicle; isSelected: boolean; onClick: () => void }) {
  const img = Array.isArray(vehicle.images) ? vehicle.images[0] : vehicle.images;
  return (
    <button
      onClick={onClick}
      data-map-card={vehicle.id}
      className={`w-full text-left p-3 border-b border-border flex gap-3 transition-colors ${isSelected ? 'bg-foreground/[0.05]' : 'hover:bg-muted'}`}
    >
      <div className={`w-1 shrink-0 self-stretch ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />
      <div className="w-20 h-14 bg-muted shrink-0 overflow-hidden">
        <img src={img} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold truncate">{vehicle.year} {vehicle.make} {vehicle.model}</p>
        <p className="text-[13px] font-black mt-0.5">${vehicle.price.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{vehicle.location}</p>
      </div>
    </button>
  );
}

function FilterChips({ filters, setFilters, onClearAll }: { filters: FilterState; setFilters: (f: FilterState) => void; onClearAll: () => void }) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.make)                   chips.push({ label: filters.make.replace(/_/g, ' '), onRemove: () => setFilters({ ...filters, make: '', model: '' }) });
  if (filters.model)                  chips.push({ label: filters.model, onRemove: () => setFilters({ ...filters, model: '' }) });
  if (filters.priceMin || filters.priceMax) chips.push({ label: `$${filters.priceMin || '0'} - $${filters.priceMax || 'any'}`, onRemove: () => setFilters({ ...filters, priceMin: '', priceMax: '' }) });
  if (filters.yearMin || filters.yearMax)   chips.push({ label: `${filters.yearMin || 'any'} - ${filters.yearMax || 'any'}`, onRemove: () => setFilters({ ...filters, yearMin: '', yearMax: '' }) });
  if (filters.mileageMax)             chips.push({ label: `Under ${(Number(filters.mileageMax) / 1000).toFixed(0)}k mi`, onRemove: () => setFilters({ ...filters, mileageMax: '' }) });
  if (filters.radius)                 chips.push({ label: `${filters.radius} mi radius`, onRemove: () => setFilters({ ...filters, radius: '' }) });
  filters.vehicleTypes.forEach((t)  => chips.push({ label: t, onRemove: () => setFilters({ ...filters, vehicleTypes: filters.vehicleTypes.filter((v) => v !== t) }) }));
  filters.fuelTypes.forEach((t)     => chips.push({ label: t, onRemove: () => setFilters({ ...filters, fuelTypes: filters.fuelTypes.filter((v) => v !== t) }) }));
  filters.driveTypes.forEach((t)    => chips.push({ label: t, onRemove: () => setFilters({ ...filters, driveTypes: filters.driveTypes.filter((v) => v !== t) }) }));
  if (filters.transmission)          chips.push({ label: filters.transmission, onRemove: () => setFilters({ ...filters, transmission: '' }) });
  if (filters.exteriorColor)         chips.push({ label: filters.exteriorColor, onRemove: () => setFilters({ ...filters, exteriorColor: '' }) });
  if (filters.belowMarket)           chips.push({ label: 'Below Market', onRemove: () => setFilters({ ...filters, belowMarket: false }) });
  if (filters.verifiedSeller)        chips.push({ label: 'Verified Seller', onRemove: () => setFilters({ ...filters, verifiedSeller: false }) });
  if (filters.ownershipVerified)     chips.push({ label: 'Ownership documents reviewed', onRemove: () => setFilters({ ...filters, ownershipVerified: false }) });
  if (filters.vehicleVerified)       chips.push({ label: 'Vehicle Verified', onRemove: () => setFilters({ ...filters, vehicleVerified: false }) });
  if (filters.inspectionVerified)    chips.push({ label: 'Inspection Verified', onRemove: () => setFilters({ ...filters, inspectionVerified: false }) });
  if (filters.cleanTitle)            chips.push({ label: 'Clean Title', onRemove: () => setFilters({ ...filters, cleanTitle: false }) });
  if (filters.noAccidents)           chips.push({ label: 'No Accidents', onRemove: () => setFilters({ ...filters, noAccidents: false }) });
  if (filters.numOwners)             chips.push({ label: `${filters.numOwners} owner${filters.numOwners === '1' ? '' : 's'}`, onRemove: () => setFilters({ ...filters, numOwners: '' }) });
  if (filters.hasMaintenanceRecords) chips.push({ label: 'Has Records', onRemove: () => setFilters({ ...filters, hasMaintenanceRecords: false }) });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {chips.map((c) => (
        <span key={c.label} className={CHIP_CLS}>
          {c.label}
          <button onClick={c.onRemove} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={`Remove ${c.label} filter`}>
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 self-center">
        Clear all
      </button>
    </div>
  );
}

export function SearchPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const latParam = urlParams.get('lat');
  const lngParam = urlParams.get('lng');
  const initialLat = latParam === null ? NaN : Number(latParam);
  const initialLng = lngParam === null ? NaN : Number(lngParam);
  const hasInitialLocation =
    latParam !== null &&
    lngParam !== null &&
    Number.isFinite(initialLat) &&
    Number.isFinite(initialLng) &&
    !(initialLat === 0 && initialLng === 0);
  const nearbyMode = urlParams.get('nearby') === '1';
  const [filters, setFilters]           = useState<FilterState>({
    ...DEFAULT_FILTERS,
    make: urlParams.get('make') || '',
    model: urlParams.get('model') || '',
    radius: urlParams.get('radius') || (nearbyMode ? '100' : ''),
  });
  const [sortBy, setSortBy]             = useState(urlParams.get('sort') || (hasInitialLocation ? 'closest' : 'recommended'));
  const [viewMode, setViewMode]         = useState<'grid' | 'map'>('grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [searchText, setSearchText]     = useState(urlParams.get('q') || '');
  const [sortOpen, setSortOpen]         = useState(false);
  const [remoteVehicles, setRemoteVehicles] = useState<Vehicle[]>([]);
  const [vehicleLoadError, setVehicleLoadError] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    hasInitialLocation ? { lat: initialLat, lng: initialLng } : (nearbyMode || urlParams.get('radius') ? DEFAULT_SEARCH_LOCATION : null)
  );
  const [locationError, setLocationError] = useState('');
  const mapListRef                      = useRef<HTMLDivElement>(null);
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    let alive = true;
    listVehicles({
      q: urlParams.get('q') || undefined,
      make: urlParams.get('make') || undefined,
      model: urlParams.get('model') || undefined,
      radius: urlParams.get('radius') || (nearbyMode ? '100' : undefined),
      lat: hasInitialLocation ? initialLat : (nearbyMode || urlParams.get('radius') ? DEFAULT_SEARCH_LOCATION.lat : undefined),
      lng: hasInitialLocation ? initialLng : (nearbyMode || urlParams.get('radius') ? DEFAULT_SEARCH_LOCATION.lng : undefined),
      sort: urlParams.get('sort') || undefined,
    })
      .then((items) => {
        if (alive) {
          setRemoteVehicles(items);
          setVehicleLoadError('');
        }
      })
      .catch((error) => {
        if (alive) {
          setRemoteVehicles([]);
          setVehicleLoadError(error.message || 'Unable to load listings.');
        }
      });
    return () => { alive = false; };
  }, []);

  // Filtered + sorted vehicles
  const vehicles = useMemo(() => {
    const locationAnchor = userLocation || (filters.radius ? DEFAULT_SEARCH_LOCATION : null);
    const filtered = applyLocationFilter(
      applyFilters(remoteVehicles, filters, searchText),
      locationAnchor,
      filters.radius
    );
    return applySort(filtered, sortBy, locationAnchor);
  }, [filters, remoteVehicles, sortBy, searchText, userLocation]);

  const filterCount = countFilters(filters);
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const enableLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setFilters((current) => ({ ...current, radius: current.radius || '100' }));
        setSortBy((current) => current === 'recommended' ? 'closest' : current);
        setLocationError('');
      },
      () => setLocationError('Unable to access your location. Check browser location permissions and try again.'),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    );
  };

  // Scroll selected map card into view
  useEffect(() => {
    if (!selectedMapId || !mapListRef.current) return;
    const el = mapListRef.current.querySelector(`[data-map-card="${selectedMapId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedMapId]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileFiltersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileFiltersOpen]);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort';

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">

      <div className="sticky top-14 z-30 bg-background border-b border-border px-4 md:px-6 py-2.5 flex items-center gap-2.5">

        {/* Mobile: Filters button */}
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="lg:hidden flex items-center gap-2 h-9 px-3 border border-border text-[12px] font-medium hover:bg-muted transition-colors shrink-0"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {filterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 bg-foreground text-background text-[10px] font-bold rounded-sm">
              {filterCount}
            </span>
          )}
        </button>

        {/* Search input */}
        <div className="relative flex-1 max-w-72 min-w-[160px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search make, model..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={`${INPUT_CLS} pl-9 pr-3`}
          />
        </div>

        {/* Results count - desktop */}
        <span className="text-[12px] text-muted-foreground hidden sm:block shrink-0">
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} found
        </span>

        <div className="flex-1" />

        {/* Sort dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center gap-2 h-9 px-3 border border-border text-[12px] font-medium hover:bg-muted transition-colors whitespace-nowrap"
          >
            <span className="hidden sm:inline">{sortLabel}</span>
            <span className="sm:hidden">Sort</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border shadow-md min-w-[180px] py-1">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setSortBy(o.value); setSortOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-[12px] transition-colors ${
                      sortBy === o.value
                        ? 'bg-foreground/5 font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Grid / Map toggle */}
        <div className="flex border border-border shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            title="Grid view"
            className={`h-9 w-9 flex items-center justify-center transition-colors ${
              viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('map')}
            aria-pressed={viewMode === 'map'}
            title="Map view"
            className={`h-9 w-9 flex items-center justify-center border-l border-border transition-colors ${
              viewMode === 'map' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Map className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <aside
          className="hidden lg:flex w-64 h-[calc(100vh-7rem)] shrink-0 flex-col border-r border-border px-5 pt-3 pb-5 overflow-hidden"
        >
          <FilterSidebarContent filters={filters} setFilters={setFilters} onClear={clearFilters} />
        </aside>

        {mobileFiltersOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden
          />
        )}
        <div
          className={`fixed inset-x-0 bottom-0 z-50 lg:hidden bg-background flex flex-col transition-transform duration-300 ease-out rounded-t-2xl ${
            mobileFiltersOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight: '92dvh' }}
        >
          {/* Handle + header */}
          <div className="shrink-0 flex flex-col">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.18em]">Filters</h2>
              <button onClick={() => setMobileFiltersOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Scrollable content */}
          <div className="flex-1 overflow-hidden px-5 py-5">
            <FilterSidebarContent filters={filters} setFilters={setFilters} onClear={clearFilters} />
          </div>
          {/* Apply button */}
          <div className="shrink-0 px-5 py-4 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full h-11 bg-foreground text-background text-[12px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
            >
              Show {vehicles.length} Result{vehicles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          {viewMode === 'grid' ? (

            <div className="px-4 md:px-6 py-5">
              <FilterChips filters={filters} setFilters={setFilters} onClearAll={clearFilters} />

              {vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border text-center">
                  <SearchIcon className="h-8 w-8 text-muted-foreground mb-4 opacity-30" />
                  <p className="text-[14px] font-bold mb-1.5">No results found</p>
                  <p className="text-[13px] text-muted-foreground mb-6 max-w-xs">
                    {vehicleLoadError || 'Try adjusting your filters or broadening your search.'}
                  </p>
                  <button
                    onClick={clearFilters}
                    className="h-9 px-5 border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-muted transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                  {vehicles.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
                </div>
              )}
            </div>

          ) : (

            <div className="flex" style={{ height: 'calc(100vh - 7rem)' }}>

              {/* Left: scrollable card list */}
              <div ref={mapListRef} className="hidden md:flex w-72 shrink-0 border-r border-border overflow-y-auto flex-col">
                <div className="px-4 py-2.5 border-b border-border bg-background sticky top-0 z-10 shrink-0">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {vehicles.length} listing{vehicles.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={enableLocation}
                    className="mt-2 text-[11px] font-bold uppercase tracking-wider text-foreground underline underline-offset-2"
                  >
                    {userLocation ? 'Location enabled' : 'Use my location'}
                  </button>
                  {locationError && <p className="mt-1 text-[11px] text-destructive">{locationError}</p>}
                </div>

                {vehicles.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-[12px] text-muted-foreground">
                      {vehicleLoadError || 'No listings match your filters.'}
                    </p>
                    <button onClick={clearFilters} className="mt-3 text-[12px] underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors">
                      Clear filters
                    </button>
                  </div>
                ) : (
                  vehicles.map((v) => (
                    <MapListCard
                      key={v.id}
                      vehicle={v}
                      isSelected={selectedMapId === v.id}
                      onClick={() => setSelectedMapId(v.id === selectedMapId ? null : v.id)}
                    />
                  ))
                )}
              </div>

              {/* Right: map */}
              <div className="flex-1 min-w-0">
                <MapView
                  vehicles={vehicles}
                  selectedId={selectedMapId}
                  onSelectPin={setSelectedMapId}
                  isDark={isDark}
                  userLocation={userLocation || (filters.radius ? DEFAULT_SEARCH_LOCATION : null)}
                  className="w-full h-full"
                />
              </div>
            </div>

          )}
        </div>
      </div>
    </div>
  );
}
