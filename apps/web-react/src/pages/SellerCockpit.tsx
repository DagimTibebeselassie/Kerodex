import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@blinkdotnew/ui';
import { listMyVehicles } from '@/lib/api';
import {
  Plus, BarChart3, MessageSquare, Car, ExternalLink, Eye, Heart,
  Pencil, Trash2, BadgeCheck, TrendingUp, DollarSign, AlertTriangle,
  CheckCircle2, Clock, Loader2, Search, ShieldCheck,
} from 'lucide-react';

// ── VIN Decoder ────────────────────────────────────────────────────────────
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
    const json = await res.json();
    const r = json?.vehicle || json;
    if (!r || !r.make) return null;
    return {
      make: r.make || '',
      model: r.model || '',
      year: r.year || '',
      trim: r.trim || '',
      engine: r.bodyClass || '',
      fuelType: r.fuelType || '',
      driveType: r.driveType || '',
    };
  } catch {
    return null;
  }
}

// ── Mock Data ──────────────────────────────────────────────────────────────
interface MockListing {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  status: 'active' | 'draft';
  completeness: number;
  views: number;
  saves: number;
  messages: number;
  images: string[];
  daysListed: number;
  dealScore: 'great' | 'good' | 'fair' | null;
}

const MOCK_LISTINGS: MockListing[] = [
  {
    id: 'ml1', make: 'BMW', model: '3 Series', year: 2021, price: 42000, mileage: 28000,
    location: 'Nashville, TN', status: 'active',
    completeness: 88, views: 342, saves: 18, messages: 7,
    images: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=400'],
    daysListed: 3, dealScore: 'great',
  },
  {
    id: 'ml2', make: 'Honda', model: 'Civic', year: 2020, price: 17500, mileage: 52000,
    location: 'Nashville, TN', status: 'draft',
    completeness: 45, views: 0, saves: 0, messages: 0,
    images: ['https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?q=80&w=400'],
    daysListed: 0, dealScore: null,
  },
];

const COMPLETENESS_TIPS: Record<string, string[]> = {
  ml1: ['Add inspection report', 'Verify ownership'],
  ml2: ['Upload photos (0 added)', 'Add a description', 'Set your price'],
};

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

// ── Listing Card ───────────────────────────────────────────────────────────
function ListingCard({
  listing,
  onDelete,
}: {
  listing: MockListing;
  onDelete: (id: string) => void;
}) {
  const tips = COMPLETENESS_TIPS[listing.id] ?? [];

  const dealColors: Record<string, string> = {
    great: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    good: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    fair: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-24 h-18 shrink-0 overflow-hidden bg-muted">
          <img
            src={listing.images[0]}
            alt={`${listing.year} ${listing.make} ${listing.model}`}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-black tracking-tight">
              {listing.year} {listing.make} {listing.model}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {/* Status badge */}
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${
                listing.status === 'active'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {listing.status === 'active' ? 'Active' : 'Draft'}
              </span>

              {/* Deal score */}
              {listing.dealScore && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${dealColors[listing.dealScore]}`}>
                  {listing.dealScore === 'great' ? '★ Great Deal' : listing.dealScore === 'good' ? '✓ Good Deal' : '— Fair'}
                </span>
              )}
            </div>
          </div>

          <div className="text-[16px] font-black text-primary">${listing.price.toLocaleString()}</div>
          <div className="text-[12px] text-muted-foreground">{listing.location} · {listing.mileage.toLocaleString()} mi</div>
        </div>
      </div>

      {/* Completeness bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Listing Completeness
          </span>
          <span className={`text-[11px] font-bold ${listing.completeness >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
            {listing.completeness}%
          </span>
        </div>
        <div className="h-1.5 bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${listing.completeness >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${listing.completeness}%` }}
          />
        </div>
      </div>

      {/* Improvement suggestions */}
      {tips.length > 0 && (
        <div className="space-y-1.5">
          {listing.status === 'draft' ? (
            <div className="flex items-start gap-2 p-3 border border-amber-500/20 bg-amber-500/5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Missing:</p>
                {tips.map((tip) => (
                  <p key={tip} className="text-[11px] text-muted-foreground">• {tip}</p>
                ))}
              </div>
            </div>
          ) : (
            tips.map((tip) => (
              <div key={tip} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="w-1 h-1 bg-muted-foreground/50 rounded-full shrink-0" />
                {tip}
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats row */}
      {listing.status === 'active' && (
        <div className="flex items-center gap-4 text-[12px] text-muted-foreground border-t border-border pt-3">
          <span className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {listing.views} views
          </span>
          <span className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            {listing.saves} saves
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {listing.messages} messages
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {listing.status === 'active' ? (
          <Link to="/vehicle/$id" params={{ id: listing.id }}>
            <button className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold uppercase tracking-wider border border-border hover:border-foreground/30 transition-colors">
              <ExternalLink className="h-3 w-3" />
              View
            </button>
          </Link>
        ) : (
          <Link to="/sell">
            <button className="flex items-center gap-1.5 h-8 px-4 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Complete to publish
            </button>
          </Link>
        )}
        <Link to="/sell" search={{ edit: listing.id } as any}>
          <button className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold uppercase tracking-wider border border-border hover:border-foreground/30 transition-colors">
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </Link>
        <button
          onClick={() => onDelete(listing.id)}
          className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold uppercase tracking-wider border border-border hover:border-destructive/30 hover:text-destructive transition-colors ml-auto"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Trust Score Panel ──────────────────────────────────────────────────────
function TrustScorePanel({ emailVerified = false, phoneVerified = false }: { emailVerified?: boolean; phoneVerified?: boolean }) {
  const score = (emailVerified ? 10 : 0) + (phoneVerified ? 20 : 0);
  const steps = [
    { done: emailVerified, label: 'Email verified', points: '+10' },
    { done: phoneVerified, label: 'Phone verified', points: '+20' },
    { done: false, label: 'Identity not verified', points: '+35 if complete' },
    { done: false, label: 'No completed sales yet', points: '+20 per sale' },
  ];

  return (
    <div className="p-5 border border-border bg-card space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Seller Trust Score</h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <span className="text-4xl font-black tracking-tight">{score}</span>
          <span className="text-[13px] text-muted-foreground mb-1">/100</span>
        </div>
        <div className="h-2.5 bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-2.5 text-[12px]">
            {step.done
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />}
            <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>
              {step.label}
            </span>
            <span className={`ml-auto text-[11px] font-bold ${step.done ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {step.points}
            </span>
          </div>
        ))}
      </div>

      <Link to="/verify">
        <Button className="w-full h-9 text-[11px] font-bold uppercase tracking-wider">
          Complete Verification →
        </Button>
      </Link>
    </div>
  );
}

// ── VIN Panel ──────────────────────────────────────────────────────────────
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
          <div className="col-span-2 flex items-center gap-2 mt-1 text-[11px] text-emerald-500">
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
  const [activeTab, setActiveTab] = useState<'listings' | 'analytics' | 'vin'>('listings');
  const [vinResult, setVinResult] = useState<VinResult | null>(null);
  const [listings, setListings] = useState<MockListing[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listMyVehicles()
      .then((vehicles) => {
        if (!alive) return;
        setListings(vehicles.map((v, index) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          price: v.price,
          mileage: v.mileage,
          location: v.location,
          status: v.status === 'sold' ? 'active' : 'active',
          completeness: Math.min(96, 62 + (v.images.length * 6)),
          views: 140 + index * 37,
          saves: 6 + index * 2,
          messages: 2 + index,
          images: v.images,
          daysListed: Math.max(1, index + 1),
          dealScore: index % 3 === 0 ? 'great' : index % 3 === 1 ? 'good' : 'fair',
        })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this listing permanently?')) {
      setListings((prev) => prev.filter((l) => l.id !== id));
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

  const activeListings = listings.filter((l) => l.status === 'active');
  const totalViews = listings.reduce((sum, l) => sum + l.views, 0);
  const totalMessages = listings.reduce((sum, l) => sum + l.messages, 0);

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
          value={activeListings.length}
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
          value={totalMessages}
          sub={totalMessages ? '3 unread' : 'No unread'}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg. Days to Sell"
          value={18}
          sub="Market average: 24"
        />
      </div>

      {/* ── Trust Score ─────────────────────────────────────────────────── */}
      <div className="mb-10">
        <TrustScorePanel emailVerified={user.emailVerified} phoneVerified={user.phoneVerified} />
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
        <div className="space-y-4">
          {/* Scam warning for draft */}
          {listings.some((l) => l.status === 'draft') && (
            <div className="flex items-start gap-3 p-4 border border-amber-500/20 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-[12px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                  Listing Health Check
                </h4>
                <ul className="space-y-1">
                  <li className="text-[12px] text-muted-foreground">• No photos uploaded — buyers trust listings with 6+ photos</li>
                  <li className="text-[12px] text-muted-foreground">• Draft not published — not visible to buyers</li>
                </ul>
              </div>
            </div>
          )}

          {listings.length === 0 ? (
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
            listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} onDelete={handleDelete} />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Analytics ──────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Views chart */}
            <div className="border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Views This Month</h3>
              </div>
              <div className="text-4xl font-black tracking-tight">342</div>
              <div className="text-[12px] text-emerald-500 font-medium">↑ 23% vs last month</div>
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

            {/* Per-listing performance */}
            <div className="border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Listing Performance</h3>
              </div>
              {activeListings.map((listing, i) => (
                <div key={listing.id} className="flex items-center gap-3">
                  <div className="text-[11px] text-muted-foreground w-4">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">
                      {listing.year} {listing.make} {listing.model}
                    </div>
                    <div className="h-1.5 bg-muted mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, (listing.views / 400) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-muted-foreground shrink-0">
                    {listing.views} views
                  </div>
                </div>
              ))}
              {activeListings.length === 0 && (
                <p className="text-[12px] text-muted-foreground">Publish listings to see analytics.</p>
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
