import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Vehicle } from '@/types';
import { listVehicles } from '@/lib/api';
import { MAKES, getModelsForMake } from '@/data/makes-models';
import { VehicleCard } from '@/components/VehicleCard';
import { MapView } from '@/components/MapView';
import { Button, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@blinkdotnew/ui';
import {
  SlidersHorizontal,
  LayoutGrid,
  Map,
  X,
  ChevronDown,
  ChevronUp,
  Search as SearchIcon,
  Filter,
} from 'lucide-react';

// ── Year options ─────────────────────────────────────────────────────────────
const YEARS: number[] = [];
for (let y = 2026; y >= 1990; y--) YEARS.push(y);

// ── Vehicle types ─────────────────────────────────────────────────────────────
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Convertible', 'Van', 'Wagon'] as const;
const FUEL_TYPES = ['Gas', 'Hybrid', 'EV', 'Diesel', 'Plug-in Hybrid'] as const;
const DRIVE_TYPES = ['FWD', 'AWD', 'RWD', '4WD'] as const;
const MILEAGE_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Under 25k mi', value: '25000' },
  { label: 'Under 50k mi', value: '50000' },
  { label: 'Under 75k mi', value: '75000' },
  { label: 'Under 100k mi', value: '100000' },
  { label: 'Under 150k mi', value: '150000' },
] as const;

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Mileage ↑', value: 'mileage_asc' },
];

// ── Filter state type ────────────────────────────────────────────────────────
interface FilterState {
  priceMin: string;
  priceMax: string;
  vehicleTypes: string[];
  make: string;
  model: string;
  yearMin: string;
  yearMax: string;
  mileage: string;
  fuelTypes: string[];
  driveTypes: string[];
  cleanTitleOnly: boolean;
  noAccidents: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  priceMin: '',
  priceMax: '',
  vehicleTypes: [],
  make: '',
  model: '',
  yearMin: '',
  yearMax: '',
  mileage: '',
  fuelTypes: [],
  driveTypes: [],
  cleanTitleOnly: false,
  noAccidents: false,
};

// ── Count active filters ─────────────────────────────────────────────────────
function countFilters(f: FilterState): number {
  let n = 0;
  if (f.priceMin || f.priceMax) n++;
  if (f.vehicleTypes.length) n++;
  if (f.make) n++;
  if (f.yearMin || f.yearMax) n++;
  if (f.mileage) n++;
  if (f.fuelTypes.length) n++;
  if (f.driveTypes.length) n++;
  if (f.cleanTitleOnly) n++;
  if (f.noAccidents) n++;
  return n;
}

// ── Checkbox group helper ─────────────────────────────────────────────────────
function CheckboxItem({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer group">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 border border-border bg-background accent-foreground cursor-pointer"
      />
      <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors select-none">
        {label}
      </span>
    </label>
  );
}

// ── Filter Sidebar Content ────────────────────────────────────────────────────
function FilterSidebarContent({
  filters,
  setFilters,
  onClear,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  onClear: () => void;
}) {
  const [showExtra, setShowExtra] = useState(false);
  const modelOptions = filters.make ? getModelsForMake(filters.make) : [];

  const toggleSet = (key: 'vehicleTypes' | 'fuelTypes' | 'driveTypes', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </h2>
        <button
          onClick={onClear}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Clear all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* Price Range */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Price Range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
              <input
                id="filter-price-min"
                type="number"
                placeholder="Min"
                min={0}
                value={filters.priceMin}
                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                className="w-full h-9 pl-5 pr-2 text-[12px] border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
              />
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
              <input
                id="filter-price-max"
                type="number"
                placeholder="Max"
                min={0}
                value={filters.priceMax}
                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                className="w-full h-9 pl-5 pr-2 text-[12px] border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Type */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Vehicle Type</p>
          <div className="space-y-2">
            {VEHICLE_TYPES.map((type) => (
              <CheckboxItem
                key={type}
                id={`filter-type-${type.toLowerCase()}`}
                label={type}
                checked={filters.vehicleTypes.includes(type)}
                onChange={() => toggleSet('vehicleTypes', type)}
              />
            ))}
          </div>
        </div>

        {/* Make */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Make</p>
          <select
            id="filter-make"
            value={filters.make}
            onChange={(e) => setFilters({ ...filters, make: e.target.value, model: '' })}
            className="w-full h-9 px-2.5 text-[12px] border border-border bg-background text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
          >
            <option value="">Any Make</option>
            {MAKES.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Model — only visible when make is selected */}
        {filters.make && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Model</p>
            <select
              id="filter-model"
              value={filters.model}
              onChange={(e) => setFilters({ ...filters, model: e.target.value })}
              className="w-full h-9 px-2.5 text-[12px] border border-border bg-background text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
            >
              <option value="">Any Model</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Year Range */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Year Range</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              id="filter-year-min"
              value={filters.yearMin}
              onChange={(e) => setFilters({ ...filters, yearMin: e.target.value })}
              className="w-full h-9 px-2.5 text-[12px] border border-border bg-background text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
            >
              <option value="">From</option>
              {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            <select
              id="filter-year-max"
              value={filters.yearMax}
              onChange={(e) => setFilters({ ...filters, yearMax: e.target.value })}
              className="w-full h-9 px-2.5 text-[12px] border border-border bg-background text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
            >
              <option value="">To</option>
              {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Mileage */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Max Mileage</p>
          <select
            id="filter-mileage"
            value={filters.mileage}
            onChange={(e) => setFilters({ ...filters, mileage: e.target.value })}
            className="w-full h-9 px-2.5 text-[12px] border border-border bg-background text-foreground outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
          >
            {MILEAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* "All Filters" toggle */}
        <button
          onClick={() => setShowExtra((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showExtra ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showExtra ? 'Fewer filters' : 'All filters'}
        </button>

        {showExtra && (
          <>
            {/* Fuel Type */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Fuel Type</p>
              <div className="space-y-2">
                {FUEL_TYPES.map((fuel) => (
                  <CheckboxItem
                    key={fuel}
                    id={`filter-fuel-${fuel.toLowerCase().replace(/\s+/g, '-')}`}
                    label={fuel}
                    checked={filters.fuelTypes.includes(fuel)}
                    onChange={() => toggleSet('fuelTypes', fuel)}
                  />
                ))}
              </div>
            </div>

            {/* Drivetrain */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">Drivetrain</p>
              <div className="space-y-2">
                {DRIVE_TYPES.map((drive) => (
                  <CheckboxItem
                    key={drive}
                    id={`filter-drive-${drive.toLowerCase()}`}
                    label={drive}
                    checked={filters.driveTypes.includes(drive)}
                    onChange={() => toggleSet('driveTypes', drive)}
                  />
                ))}
              </div>
            </div>

            {/* Title & History */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3">History</p>
              <div className="space-y-2">
                <CheckboxItem
                  id="filter-clean-title"
                  label="Clean title only"
                  checked={filters.cleanTitleOnly}
                  onChange={(v) => setFilters({ ...filters, cleanTitleOnly: v })}
                />
                <CheckboxItem
                  id="filter-no-accidents"
                  label="No accidents reported"
                  checked={filters.noAccidents}
                  onChange={(v) => setFilters({ ...filters, noAccidents: v })}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <div className="p-1 space-y-2">
        <div className="h-3.5 w-3/4 bg-muted animate-pulse" />
        <div className="h-3 w-1/2 bg-muted animate-pulse" />
        <div className="h-3 w-1/3 bg-muted animate-pulse" />
      </div>
    </div>
  );
}

// ── Map list card ─────────────────────────────────────────────────────────────
function MapListCard({
  vehicle,
  isSelected,
  onClick,
}: {
  vehicle: Vehicle;
  isSelected: boolean;
  onClick: () => void;
}) {
  const imageUrl = (() => {
    try {
      const parsed = typeof vehicle.images === 'string' ? JSON.parse(vehicle.images) : vehicle.images;
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return vehicle.images as unknown as string;
    }
  })() || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=400';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-border flex gap-3 transition-colors ${
        isSelected ? 'bg-foreground/5' : 'hover:bg-muted'
      }`}
    >
      <div
        className={`w-1 shrink-0 ${isSelected ? 'bg-foreground' : 'bg-transparent'}`}
      />
      <div className="w-20 h-16 bg-muted shrink-0 overflow-hidden">
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold truncate">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        <p className="text-[13px] font-black mt-0.5">${vehicle.price.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{vehicle.location}</p>
      </div>
    </button>
  );
}

// ── Main Search Page ──────────────────────────────────────────────────────────
export function SearchPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const mapListRef = useRef<HTMLDivElement>(null);

  // Scroll selected card into view in map strip
  useEffect(() => {
    if (!selectedMapId || !mapListRef.current) return;
    const el = mapListRef.current.querySelector(`[data-map-card="${selectedMapId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedMapId]);

  // Lock body scroll when mobile filter drawer open
  useEffect(() => {
    document.body.style.overflow = mobileFiltersOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileFiltersOpen]);

  const buildQuery = useCallback(() => {
    return {
      q: searchText,
      make: filters.make.replace(/_/g, ' '),
      model: filters.model,
      minPrice: filters.priceMin,
      maxPrice: filters.priceMax,
      minYear: filters.yearMin,
      maxYear: filters.yearMax,
      maxMileage: filters.mileage,
      cleanTitle: filters.cleanTitleOnly ? 1 : undefined,
      noAccidents: filters.noAccidents ? 1 : undefined,
    };
  }, [filters, searchText]);

  const sortVehicles = useCallback((items: Vehicle[]) => {
    const sorted = [...items];
    switch (sortBy) {
      case 'price_asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'mileage_asc':
        return sorted.sort((a, b) => a.mileage - b.mileage);
      default:
        return sorted;
    }
  }, [sortBy]);

  const { data: rawVehicles, isLoading } = useQuery({
    queryKey: ['vehicles', 'search', filters, sortBy, searchText],
    queryFn: async () => {
      const result = await listVehicles(buildQuery());
      return sortVehicles(result).slice(0, 60) as Vehicle[];
    },
  });

  const vehicles = rawVehicles ?? [];
  const filterCount = countFilters(filters);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-background border-b border-border px-4 md:px-6 py-3 flex flex-wrap items-center gap-3">
        {/* Mobile: Filters button */}
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="lg:hidden flex items-center gap-2 h-9 px-3 border border-border text-[12px] font-medium hover:bg-muted transition-colors"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {filterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 bg-foreground text-background text-[10px] font-bold">
              {filterCount}
            </span>
          )}
        </button>

        {/* Search box */}
        <div className="relative flex-1 max-w-xs min-w-[180px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search make, model…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-[12px] border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
          />
        </div>

        {/* Results count */}
        <span className="text-[12px] text-muted-foreground hidden sm:block">
          {isLoading ? '…' : `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} found`}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 h-9 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex border border-border">
          <button
            id="view-toggle-grid"
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
            id="view-toggle-map"
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

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop Filter Sidebar ──────────────────────────────────── */}
        <aside
          id="filter-sidebar"
          className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border px-6 py-6 overflow-y-auto"
          style={{ height: 'calc(100vh - 7rem)', position: 'sticky', top: '7rem' }}
        >
          <FilterSidebarContent
            filters={filters}
            setFilters={setFilters}
            onClear={clearFilters}
          />
        </aside>

        {/* ── Mobile Filter Drawer ────────────────────────────────────── */}
        {mobileFiltersOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
        )}
        <div
          className={`fixed top-0 left-0 bottom-0 z-50 w-80 bg-background border-r border-border flex flex-col lg:hidden transition-transform duration-300 ${
            mobileFiltersOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em]">Filters</h2>
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FilterSidebarContent
              filters={filters}
              setFilters={setFilters}
              onClear={clearFilters}
            />
          </div>
          <div className="shrink-0 px-5 py-4 border-t border-border">
            <Button
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full h-11 text-[12px] font-bold uppercase tracking-wider"
            >
              Show {vehicles.length} Result{vehicles.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>

        {/* ── Main content area ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {viewMode === 'grid' ? (
            /* ── GRID VIEW ─────────────────────────────────────────── */
            <div className="px-4 md:px-6 py-6">
              {/* Active filter chips */}
              {filterCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {filters.make && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-[11px] font-medium">
                      {filters.make.replace(/_/g, ' ')}
                      <button onClick={() => setFilters({ ...filters, make: '', model: '' })} className="text-muted-foreground hover:text-foreground">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                  {filters.vehicleTypes.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-[11px] font-medium">
                      {t}
                      <button onClick={() => setFilters({ ...filters, vehicleTypes: filters.vehicleTypes.filter((v) => v !== t) })} className="text-muted-foreground hover:text-foreground">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {(filters.priceMin || filters.priceMax) && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-[11px] font-medium">
                      ${filters.priceMin || '0'} – ${filters.priceMax || '∞'}
                      <button onClick={() => setFilters({ ...filters, priceMin: '', priceMax: '' })} className="text-muted-foreground hover:text-foreground">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                  {filters.mileage && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border text-[11px] font-medium">
                      Under {(Number(filters.mileage) / 1000).toFixed(0)}k mi
                      <button onClick={() => setFilters({ ...filters, mileage: '' })} className="text-muted-foreground hover:text-foreground">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={clearFilters}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                  {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border text-center">
                  <SearchIcon className="h-8 w-8 text-muted-foreground mb-4 opacity-40" />
                  <p className="text-[14px] font-bold mb-2">No results found</p>
                  <p className="text-[13px] text-muted-foreground mb-6 max-w-xs">
                    Try adjusting your filters or expanding your search area.
                  </p>
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="h-9 px-5 text-[11px] font-bold uppercase tracking-wider"
                  >
                    Clear Filters
                  </Button>
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
            /* ── MAP VIEW ──────────────────────────────────────────── */
            <div
              className="flex"
              style={{ height: 'calc(100vh - 7rem)' }}
            >
              {/* Left: scrollable card strip */}
              <div
                ref={mapListRef}
                className="w-72 shrink-0 border-r border-border overflow-y-auto"
              >
                {/* Count */}
                <div className="px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {isLoading ? 'Loading…' : `${vehicles.length} listing${vehicles.length !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-20 h-14 bg-muted animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-3/4 bg-muted animate-pulse" />
                          <div className="h-3 w-1/2 bg-muted animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-[12px] text-muted-foreground">No listings match your filters.</p>
                    <button
                      onClick={clearFilters}
                      className="mt-3 text-[12px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  vehicles.map((vehicle) => (
                    <div key={vehicle.id} data-map-card={vehicle.id}>
                      <MapListCard
                        vehicle={vehicle}
                        isSelected={selectedMapId === vehicle.id}
                        onClick={() => setSelectedMapId(vehicle.id === selectedMapId ? null : vehicle.id)}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Right: Map */}
              <div className="flex-1 min-w-0">
                <MapView
                  vehicles={vehicles}
                  selectedId={selectedMapId}
                  onSelectPin={setSelectedMapId}
                  isDark={isDark}
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
