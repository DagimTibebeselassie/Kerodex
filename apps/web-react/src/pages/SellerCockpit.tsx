import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, toast } from '@blinkdotnew/ui';
import { listMyListingAnalytics, removeListing, updateListingStatus } from '@/lib/api';
import {
  Plus, BarChart3, MessageSquare, Car, ExternalLink, Eye, Heart,
  Pencil, Trash2, BadgeCheck, TrendingUp, DollarSign, AlertTriangle,
  CheckCircle2, Clock, Loader2, Search, ShieldCheck,
} from 'lucide-react';
import { MAKES } from '@/data/makes-models';

interface VinResult {
  make: string;
  model: string;
  year: string;
  trim: string;
  engine: string;
  fuelType: string;
  driveType: string;
}

function makeOptionFromDecode(make: string): string {
  const normalized = make.trim().toLowerCase().replace(/\s+/g, '_');
  return MAKES.find((option) => option.toLowerCase() === normalized) || make.trim();
}

async function decodeVin(vin: string): Promise<VinResult | null> {
  const res = await fetch(`/api/marketcheck/decode/${encodeURIComponent(vin)}`);
  const json = await res.json();
  const r = json?.vehicle || json;
  if (!res.ok) throw new Error(json.error || json.detail || 'Unable to decode VIN.');
  if (!r || !r.make) return null;
  return {
    make: makeOptionFromDecode(r.make || ''),
    model: r.model || '',
    year: r.year || '',
    trim: r.trim || '',
    engine: r.engine || r.body_type || r.bodyClass || '',
    fuelType: r.fuel_type || r.fuelType || '',
    driveType: r.drivetrain || r.driveType || '',
  };
}

interface MockListing {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  location: string;
  status: 'active' | 'draft' | 'pending_verification' | 'verification_in_progress' | string;
  completeness: number;
  views: number;
  saves: number;
  messages: number;
  conversations: number;
  uniqueViewers: number;
  contactClicks: number;
  verificationStatus: string;
  reportCount: number;
  images: string[];
  daysListed: number;
  dealScore: 'great' | 'good' | 'fair' | null;
  createdAt?: string;
  sellerNotification?: string;
}

function numberField(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function listingCompleteness(vehicle: any): number {
  const checks = [
    Boolean(vehicle.images?.length),
    Boolean(vehicle.description),
    Boolean(vehicle.price),
    Boolean(vehicle.mileage),
    Boolean(vehicle.vin),
    Boolean(vehicle.titleStatus),
    Boolean(vehicle.accidentHistory),
    Boolean(vehicle.ownerCount),
    Boolean(vehicle.features?.length),
    Boolean(vehicle.maintenanceNames?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function listingTips(listing: MockListing): string[] {
  const tips: string[] = [];
  if (!listing.images.length) tips.push('Upload photos');
  if (listing.completeness < 100) tips.push('Complete missing listing details');
                  <li className="text-[12px] text-muted-foreground">- Draft not published - not visible to buyers</li>
  if (listing.status === 'pending_verification' || listing.status === 'verification_in_progress') tips.push('Vehicle presence verification is processing');
  return tips;
}

function daysSince(value?: string): number {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.ceil((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

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

function ListingCard({
  listing,
  onDelete,
  onMarkSold,
  onMarkAvailable,
}: {
  listing: MockListing;
  onDelete: (id: string) => void;
  onMarkSold: (listing: MockListing) => void;
  onMarkAvailable: (id: string) => void;
}) {
  const tips = listingTips(listing);

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
                  : listing.status === 'sold'
                    ? 'border-border bg-muted text-muted-foreground'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {listing.status === 'active'
                  ? 'Active'
                  : listing.status === 'sold'
                    ? 'Sold'
                  : listing.status === 'pending_verification' || listing.status === 'verification_in_progress'
                    ? 'Pending verification'
                    : 'Draft'}
              </span>

              {/* Deal score */}
              {listing.dealScore && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${dealColors[listing.dealScore]}`}>
                  {listing.dealScore === 'great' ? '* Great Deal' : listing.dealScore === 'good' ? 'Good Deal' : 'Fair Price'}
                </span>
              )}
            </div>
          </div>

          <div className="text-[16px] font-black text-primary">${listing.price.toLocaleString()}</div>
          <div className="text-[12px] text-muted-foreground">{listing.location} <span aria-hidden="true">&middot;</span> {listing.mileage.toLocaleString()} mi</div>
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
      {listing.sellerNotification && (
        <div className="flex items-start gap-2 p-3 border border-border bg-muted/20">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">{listing.sellerNotification}</p>
        </div>
      )}
      {tips.length > 0 && (
        <div className="space-y-1.5">
          {listing.status === 'draft' || listing.status === 'pending_verification' || listing.status === 'verification_in_progress' ? (
            <div className="flex items-start gap-2 p-3 border border-amber-500/20 bg-amber-500/5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  {listing.status === 'draft' ? 'Missing:' : 'Status:'}
                </p>
                {tips.map((tip) => (
                  <p key={tip} className="text-[11px] text-muted-foreground">- {tip}</p>
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
      {['active', 'sold'].includes(listing.status) && (
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
            {listing.conversations} conversations
          </span>
          <span>{listing.verificationStatus.replace(/_/g, ' ')}</span>
          <span>{listing.daysListed} days active</span>
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
              {listing.status === 'pending_verification' || listing.status === 'verification_in_progress' ? 'View status' : 'Complete to publish'}
            </button>
          </Link>
        )}
        <Link to="/sell" search={{ edit: listing.id } as any}>
          <button className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold uppercase tracking-wider border border-border hover:border-foreground/30 transition-colors">
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </Link>
        {listing.status === 'active' && (
          <button
            onClick={() => onMarkSold(listing)}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold uppercase tracking-wider border border-border hover:border-foreground/30 transition-colors"
          >
            <CheckCircle2 className="h-3 w-3" />
            Mark Sold
          </button>
        )}
        {listing.status === 'sold' && (
          <button
            onClick={() => onMarkAvailable(listing.id)}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold uppercase tracking-wider border border-border hover:border-foreground/30 transition-colors"
          >
            Mark Available
          </button>
        )}
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
          {'Complete Verification ->'}
        </Button>
      </Link>
    </div>
  );
}

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
    let r: VinResult | null = null;
    try {
      r = await decodeVin(cleaned);
    } catch (error: any) {
      setLoading(false);
      setError(error?.message || 'Unable to decode this VIN.');
      return;
    }
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
          <span className="text-[11px] text-muted-foreground ml-1">- Enter your 17-digit VIN to auto-populate the form</span>
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
            ['Trim', result.trim || '-'],
            ['Engine', result.engine || '-'],
            ['Fuel', result.fuelType || '-'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 border-b border-border/50 text-[12px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2 mt-1 text-[11px] text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            VIN verified via MarketCheck - fields populated
          </div>
        </div>
      )}
    </div>
  );
}

export function SellerCockpitPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'listings' | 'analytics' | 'vin'>('listings');
  const [vinResult, setVinResult] = useState<VinResult | null>(null);
  const [listings, setListings] = useState<MockListing[]>([]);
  const [soldListing, setSoldListing] = useState<MockListing | null>(null);
  const [soldSource, setSoldSource] = useState<'kerodex' | 'elsewhere' | 'prefer_not_to_say'>('kerodex');
  const [finalSalePrice, setFinalSalePrice] = useState('');
  const [wouldUseAgain, setWouldUseAgain] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [saleFeedback, setSaleFeedback] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listMyListingAnalytics()
      .then((records) => {
        if (!alive) return;
        setListings(records.map(({ listing: v, metrics }: any) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          price: v.price,
          mileage: v.mileage,
          location: v.location,
          status: v.status || 'active',
          completeness: listingCompleteness(v),
          views: numberField(metrics.views),
          uniqueViewers: numberField(metrics.uniqueViewers),
          saves: numberField(metrics.saves),
          messages: numberField(metrics.messagesReceived),
          conversations: numberField(metrics.conversations),
          contactClicks: numberField(metrics.contactClicks),
          verificationStatus: metrics.verificationStatus || 'not_started',
          reportCount: numberField(metrics.reportCount),
          images: v.images,
          daysListed: numberField(metrics.daysActive) || daysSince(v.createdAt),
          dealScore: Number(v.fairValueDelta) < -1000 ? 'great' : Number(v.fairValueDelta) < 0 ? 'good' : Number.isFinite(Number(v.fairValueDelta)) ? 'fair' : null,
          createdAt: v.createdAt,
          sellerNotification: v.sellerNotification,
        })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this listing permanently?')) {
      removeListing(id)
        .then(() => {
          setListings((prev) => prev.map((listing) => listing.id === id ? { ...listing, status: 'removed' } : listing));
          toast.success('Listing removed.');
        })
        .catch((error) => toast.error(error?.message || 'Unable to remove listing.'));
    }
  };

  const handleMarkAvailable = async (id: string) => {
    try {
      await updateListingStatus(id, { status: 'active' });
      setListings((current) => current.map((listing) => listing.id === id ? { ...listing, status: 'active' } : listing));
      toast.success('Listing is available again.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to update listing.');
    }
  };

  const submitSoldOutcome = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!soldListing) return;
    setStatusSaving(true);
    try {
      await updateListingStatus(soldListing.id, {
        status: 'sold',
        soldSource,
        finalSalePrice: finalSalePrice ? Number(finalSalePrice) : null,
        wouldUseAgain,
        feedbackText: saleFeedback,
      });
      setListings((current) => current.map((listing) => listing.id === soldListing.id ? { ...listing, status: 'sold' } : listing));
      setSoldListing(null);
      setFinalSalePrice('');
      setSaleFeedback('');
      toast.success('Listing marked sold.');
    } catch (error: any) {
      toast.error(error?.message || 'Unable to mark listing sold.');
    } finally {
      setStatusSaving(false);
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
  const avgDaysListed = activeListings.length
    ? Math.round(activeListings.reduce((sum, l) => sum + l.daysListed, 0) / activeListings.length)
    : 0;
  const maxViews = Math.max(...activeListings.map((listing) => listing.views), 1);

  return (
    <div className="animate-fade-in px-4 md:px-6 py-10 max-w-screen-xl mx-auto">
      {soldListing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <form onSubmit={submitSoldOutcome} className="w-full max-w-lg border border-border bg-background p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-xl font-black">Mark as sold</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {soldListing.year} {soldListing.make} {soldListing.model}
              </p>
            </div>
            <label className="block space-y-2 text-[12px] font-bold">
              <span>Did it sell through Kerodex?</span>
              <select value={soldSource} onChange={(event) => setSoldSource(event.target.value as typeof soldSource)} className="h-10 w-full border border-border bg-background px-3 font-normal">
                <option value="kerodex">Yes, through Kerodex</option>
                <option value="elsewhere">No, sold somewhere else</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
            <label className="block space-y-2 text-[12px] font-bold">
              <span>Final sale price (optional)</span>
              <Input type="number" min="0" value={finalSalePrice} onChange={(event) => setFinalSalePrice(event.target.value)} placeholder="Final sale price" />
            </label>
            <label className="block space-y-2 text-[12px] font-bold">
              <span>Would you use Kerodex again?</span>
              <select value={wouldUseAgain} onChange={(event) => setWouldUseAgain(event.target.value as typeof wouldUseAgain)} className="h-10 w-full border border-border bg-background px-3 font-normal">
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="block space-y-2 text-[12px] font-bold">
              <span>Feedback (optional)</span>
              <textarea value={saleFeedback} onChange={(event) => setSaleFeedback(event.target.value)} rows={3} className="w-full border border-border bg-background p-3 font-normal" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSoldListing(null)}>Cancel</Button>
              <Button type="submit" disabled={statusSaving}>{statusSaving ? 'Saving...' : 'Mark Sold'}</Button>
            </div>
          </form>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-1">Seller Tools</p>
          <h1 className="text-3xl font-black tracking-tight">Seller Cockpit</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Manage listings, track performance, and decode VINs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/verify' })}
            className="h-10 px-5 text-[11px] font-bold uppercase tracking-wider shrink-0"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {user.identityVerified ? 'Verified' : 'Verify Identity'}
          </Button>
          <Button
            onClick={() => navigate({ to: '/sell' })}
            className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Listing
          </Button>
        </div>
      </div>

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
          sub="From listing records"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg. Days Listed"
          value={avgDaysListed}
          sub="Across active listings"
        />
      </div>

      <div className="mb-10">
        <TrustScorePanel emailVerified={user.emailVerified} phoneVerified={user.phoneVerified} />
      </div>

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
                  <li className="text-[12px] text-muted-foreground">- No photos uploaded - buyers trust listings with 6+ photos</li>
                  <li className="text-[12px] text-muted-foreground">- Draft not published - not visible to buyers</li>
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
              <ListingCard
                key={listing.id}
                listing={listing}
                onDelete={handleDelete}
                onMarkSold={setSoldListing}
                onMarkAvailable={handleMarkAvailable}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Views chart */}
            <div className="border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-bold uppercase tracking-[0.15em]">Views This Month</h3>
              </div>
              <div className="text-4xl font-black tracking-tight">{totalViews.toLocaleString()}</div>
              <div className="text-[12px] text-muted-foreground font-medium">From active listing records</div>
              <div className="flex items-end gap-1.5 h-20 pt-4">
                {activeListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors"
                    title={`${listing.year} ${listing.make} ${listing.model}: ${listing.views} views`}
                    style={{ height: `${Math.max(6, (listing.views / maxViews) * 100)}%` }}
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
                        style={{ width: `${Math.min(100, (listing.views / maxViews) * 100)}%` }}
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
                'Listings with 6+ photos get 3x more views',
                'Price within 5% of market value sells 40% faster',
                'Verified sellers get 2x more messages',
                'Responding within 1 hour increases close rate by 60%',
              ].map((tip) => (
                <li key={tip} className="text-[12px] text-muted-foreground list-disc">{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
              Kerodex uses backend VIN decoding to auto-populate listing details without exposing provider credentials.
              This helps reduce errors and builds buyer trust.
            </p>
            <p className="text-[12px] text-muted-foreground">
              VIN verification also adds a <strong>VIN Verified</strong> badge to your listing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
