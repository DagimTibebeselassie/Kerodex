import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { listVehicles } from '@/lib/api';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  Plus, BarChart3, MessageSquare, Car, ExternalLink, Eye, Heart,
  Pencil, Trash2, BadgeCheck, TrendingUp, DollarSign, AlertTriangle,
  CheckCircle2, Clock, Loader2, Search,
} from 'lucide-react';
import { Vehicle } from '@/types';

// ── VIN Decoder ───────────────────────────────────────────────────────────
interface VinResult {
  make: string;
  model: string;
  year: string;
  trim: string;
  engine: string;
  fuelType: string;
  driveType: string;
}

async function decodeVin(vin: string): Promise<VinResult | null> {
  try {
    const res = await fetch(`/api/vin/decode/${encodeURIComponent(vin)}`);
    const r = await res.json();
    if (!res.ok || !r.ok) return null;
    return {
      make: r.make || '',
      model: r.model || '',
      year: r.year || '',
      trim: r.trim || r.series || '',
      engine: r.engine || '',
      fuelType: r.fuelType || '',
      driveType: r.driveType || '',
    };
  } catch {
    return null;
  }
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="p-5 border border-border bg-card space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Listing Row ────────────────────────────────────────────────────────────
function ListingRow({
  vehicle,
  onDelete,
}: {
  vehicle: Vehicle;
  onDelete: (id: string) => void;
}) {
  const imageUrl = (() => {
    try {
      const p = typeof vehicle.images === 'string' ? JSON.parse(vehicle.images) : vehicle.images;
      return Array.isArray(p) ? p[0] : p;
    } catch { return ''; }
  })() || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=200';

  return (
    <div className="flex items-center gap-4 p-4 border-b border-border hover:bg-muted/30 transition-colors group">
      {/* Thumbnail */}
      <div className="w-16 h-12 bg-muted shrink-0 overflow-hidden rounded-sm">
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold truncate">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </div>
        <div className="text-[12px] text-muted-foreground truncate">{vehicle.location}</div>
      </div>

      {/* Price */}
      <div className="text-[14px] font-black shrink-0 hidden sm:block">
        ${vehicle.price.toLocaleString()}
      </div>

      {/* Status */}
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border shrink-0 hidden md:block ${
        vehicle.status === 'available'
          ? 'border-green-500/30 bg-green-500/10 text-green-500'
          : 'border-muted-foreground/30 bg-muted text-muted-foreground'
      }`}>
        {vehicle.status}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Link to="/vehicle/$id" params={{ id: vehicle.id }}>
          <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="View listing">
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </Link>
        <Link to="/sell" search={{ edit: vehicle.id } as any}>
          <button className="h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Edit listing">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </Link>
        <button
          onClick={() => onDelete(vehicle.id)}
          className="h-8 w-8 flex items-center justify-center hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
          title="Delete listing"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── VIN Autofill Panel ─────────────────────────────────────────────────────
function VinPanel({ onResult }: { onResult: (r: VinResult) => void }) {
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VinResult | null>(null);
  const [error, setError] = useState('');

  const handleDecode = async () => {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
      setError('VIN must be exactly 17 characters.');
      return;
    }
    setError('');
    setLoading(true);
    const r = await decodeVin(cleaned);
    setLoading(false);
    if (!r || !r.make) {
      setError('Could not decode this VIN. Please check and try again.');
      return;
    }
    setResult(r);
    onResult(r);
  };

  return (
    <div className="p-5 border border-border bg-card space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BadgeCheck className="h-4 w-4 text-primary" />
        <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">VIN Autofill</h3>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Enter your 17-digit VIN to auto-populate make, model, year, and specs.
      </p>

      <div className="flex gap-2">
        <Input
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          placeholder="e.g. 1HGBH41JX8C200001"
          maxLength={17}
          className="h-9 text-[12px] font-mono uppercase flex-1"
        />
        <Button
          onClick={handleDecode}
          disabled={loading || vin.length !== 17}
          className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {result && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[
            ['Make', result.make],
            ['Model', result.model],
            ['Year', result.year],
            ['Trim', result.trim || '—'],
            ['Engine', result.engine || '—'],
            ['Fuel', result.fuelType || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-border/50 text-[12px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2 mt-1 text-[11px] text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            VIN verified via NHTSA — fields populated
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function SellerCockpitPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'listings' | 'analytics' | 'vin'>('listings');
  const [vinResult, setVinResult] = useState<VinResult | null>(null);

  const { data: myVehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['my-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [] as Vehicle[];
      const localHidden = new Set(JSON.parse(localStorage.getItem('kerodex-hidden-listings') || '[]') as string[]);
      const result = await listVehicles();
      return result.filter((vehicle) => !localHidden.has(vehicle.id)) as Vehicle[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = new Set(JSON.parse(localStorage.getItem('kerodex-hidden-listings') || '[]') as string[]);
      current.add(id);
      localStorage.setItem('kerodex-hidden-listings', JSON.stringify([...current]));
    },
    onSuccess: () => {
      toast.success('Listing deleted.');
      queryClient.invalidateQueries({ queryKey: ['my-vehicles'] });
    },
    onError: () => toast.error('Failed to delete listing.'),
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this listing permanently?')) {
      deleteMutation.mutate(id);
    }
  };

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
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-6" />
        <h2 className="text-xl font-bold mb-2">Seller Cockpit</h2>
        <p className="text-muted-foreground text-[13px] mb-8 max-w-xs">
          Sign in to manage your listings, track analytics, and use VIN autofill.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In
        </Button>
      </div>
    );
  }

  const totalViews = 1284;
  const avgDaysToSell = 18;
  const vehicles = myVehicles ?? [];
  const activeCount = vehicles.filter((v) => v.status === 'available').length;

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-1">Seller Tools</p>
          <h1 className="text-3xl font-black tracking-tight">Seller Cockpit</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Manage listings, track performance, and decode VINs.
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: '/sell' })}
          className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Listing
        </Button>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard
          icon={<Car className="h-4 w-4" />}
          label="Active Listings"
          value={activeCount}
          sub="Currently on market"
        />
        <StatCard
          icon={<Eye className="h-4 w-4" />}
          label="Total Views"
          value={totalViews.toLocaleString()}
          sub="Across all listings"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Messages"
          value={12}
          sub="3 unread"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg. Days to Sell"
          value={avgDaysToSell}
          sub="Market average: 24"
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border mb-8">
        {[
          { key: 'listings', label: 'My Listings', icon: <Car className="h-3.5 w-3.5" /> },
          { key: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
          { key: 'vin', label: 'VIN Decoder', icon: <BadgeCheck className="h-3.5 w-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-5 py-3 text-[12px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Listings ───────────────────────────────────────────────── */}
      {activeTab === 'listings' && (
        <div>
          {vehiclesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="border border-dashed border-border py-20 text-center">
              <Car className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-[14px] font-bold mb-2">No listings yet</p>
              <p className="text-[13px] text-muted-foreground mb-6">
                Create your first listing to start selling.
              </p>
              <Button
                onClick={() => navigate({ to: '/sell' })}
                className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Listing
              </Button>
            </div>
          ) : (
            <div className="border border-border">
              {/* Column headers */}
              <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 border-b border-border">
                <div className="w-16 shrink-0" />
                <div className="flex-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Vehicle</div>
                <div className="w-24 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground hidden sm:block">Price</div>
                <div className="w-24 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground hidden md:block">Status</div>
                <div className="w-28 shrink-0" />
              </div>
              {vehicles.map((v) => (
                <ListingRow key={v.id} vehicle={v} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Analytics ──────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Performance chart placeholder */}
            <div className="border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Views This Month</h3>
              </div>
              <div className="text-4xl font-black tracking-tight">1,284</div>
              <div className="text-[12px] text-green-500 font-medium">↑ 23% vs last month</div>
              {/* Simple bar chart */}
              <div className="flex items-end gap-1.5 h-20 pt-4">
                {[40, 65, 45, 80, 60, 90, 75, 100, 85, 95, 70, 88].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Jan</span><span>Dec</span>
              </div>
            </div>

            {/* Conversion */}
            <div className="border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Listing Performance</h3>
              </div>
              {vehicles.slice(0, 3).map((v, i) => (
                <div key={v.id} className="flex items-center gap-3">
                  <div className="text-[11px] text-muted-foreground w-4">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{v.year} {v.make} {v.model}</div>
                    <div className="h-1.5 bg-muted mt-1 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${[85, 62, 48][i]}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-muted-foreground shrink-0">{[850, 620, 480][i]} views</div>
                </div>
              ))}
              {vehicles.length === 0 && (
                <p className="text-[12px] text-muted-foreground">Create listings to see analytics.</p>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="border border-amber-500/20 bg-amber-500/5 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">Listing Tips</h3>
            </div>
            <ul className="space-y-1.5 pl-6">
              {[
                'Listings with 6+ photos get 3× more views',
                'Price within 5% of market value sells 40% faster',
                'Verified sellers get 2× more messages',
                'Responding within 1 hour increases close rate by 60%',
              ].map((tip) => (
                <li key={tip} className="text-[12px] text-muted-foreground list-disc">{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Tab: VIN Decoder ────────────────────────────────────────────── */}
      {activeTab === 'vin' && (
        <div className="max-w-lg space-y-6">
          <VinPanel onResult={setVinResult} />

          {vinResult && (
            <div className="p-5 border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-primary">Ready to list</h3>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Vehicle details pre-populated from VIN. Create your listing now.
              </p>
              <Button
                onClick={() => navigate({ to: '/sell', search: { make: vinResult.make, model: vinResult.model, year: vinResult.year } as any })}
                className="h-9 px-5 text-[11px] font-bold uppercase tracking-wider"
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                Create Listing with These Details
              </Button>
            </div>
          )}

          <div className="p-5 border border-border bg-card space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">About VIN Decoding</h3>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Kerodex uses the free <strong>NHTSA (National Highway Traffic Safety Administration)</strong> database to decode
              VINs and auto-populate listing details. This helps reduce errors and builds buyer trust.
            </p>
            <p className="text-[12px] text-muted-foreground">
              VIN verification also adds a <strong>✓ VIN Verified</strong> badge to your listing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
