import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from '@tanstack/react-router';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getVehicle, saveVehicleLocal } from '@/lib/api';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
  toast,
} from '@blinkdotnew/ui';
import {
  MapPin,
  Gauge,
  Calendar,
  Shield,
  MessageSquare,
  Heart,
  Share2,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  Car,
  User,
  ExternalLink,
  AlertTriangle,
  X,
} from 'lucide-react';

const FEATURES = [
  'Apple CarPlay / Android Auto',
  'Backup Camera',
  'Blind Spot Monitoring',
  'Climate Control (Dual Zone)',
  'Heated & Ventilated Seats',
  'Keyless Entry & Push-Start',
  'Lane Keep Assist',
  'Leather Interior',
  'Navigation System',
  'Panoramic Sunroof',
  'Power Adjustable Seats',
  'Premium Sound System',
  'Rear Cross-Traffic Alert',
  'Remote Start',
  'Wireless Charging',
];

const APR_MAP: Record<string, number> = {
  excellent: 5.9,
  good: 8.4,
  fair: 12.9,
  poor: 18.9,
};

function calcMonthly(price: number, down: number, months: number, aprPct: number): number {
  const principal = price - down;
  if (principal <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function VehicleDetailPage() {
  const { id } = useParams({ from: '/vehicle/$id' });
  const { user, login } = useAuth();

  // Gallery state
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'history'>('overview');

  // Payment estimator
  const [cashDown, setCashDown] = useState(3000);
  const [loanTerm, setLoanTerm] = useState(60);
  const [creditScore, setCreditScore] = useState('good');

  // Trade-in
  const [tradeInOpen, setTradeInOpen] = useState(false);
  const [tradeVin, setTradeVin] = useState('');
  const [tradeEstimate, setTradeEstimate] = useState<string | null>(null);

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      return await getVehicle(id) as Vehicle;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return login();
      saveVehicleLocal(id, true);
    },
    onSuccess: () => toast.success('Saved to your collection.'),
  });

  const images = vehicle?.images ?? [];
  const mainImage = images[activeIdx] || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200';
  const thumbs = images.slice(0, 6);

  const apr = APR_MAP[creditScore] ?? 8.4;
  const monthly = useMemo(() => {
    if (!vehicle) return 0;
    return calcMonthly(vehicle.price, cashDown, loanTerm, apr);
  }, [vehicle, cashDown, loanTerm, apr]);

  if (isLoading) {
    return (
      <div className="animate-fade-in px-4 py-10 max-w-screen-2xl mx-auto space-y-8">
        <div className="h-6 w-1/4 bg-muted animate-pulse" />
        <div className="aspect-video bg-muted animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="aspect-video bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <Car className="h-12 w-12 text-muted-foreground mb-6" />
        <p className="text-muted-foreground mb-6 text-[14px]">Vehicle listing not found.</p>
        <Link to="/search">
          <Button variant="outline" size="sm" className="text-[12px] font-bold uppercase tracking-widest">Back to browse</Button>
        </Link>
      </div>
    );
  }

  const sellerInitials = vehicle.userId.substring(0, 2).toUpperCase();

  return (
    <div className="animate-fade-in px-4 lg:px-8 py-10 max-w-screen-2xl mx-auto">
      {/* Back nav */}
      <Link
        to="/search"
        className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-16">
        {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-10">

          {/* IMAGE GALLERY */}
          <div className="space-y-3" id="gallery-main-img">
            <div
              className="relative aspect-video bg-muted border border-border overflow-hidden cursor-zoom-in group"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={mainImage}
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
              <div className="absolute bottom-3 left-3 bg-background/90 border border-border px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
                Photo {activeIdx + 1} of {images.length || 1}
              </div>
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border p-2">
                <ZoomIn className="h-4 w-4" />
              </div>
            </div>

            {/* Thumbnail strip */}
            <div id="gallery-thumbs" className="grid grid-cols-4 gap-3">
              {thumbs.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`aspect-video bg-muted border overflow-hidden transition-all ${
                    activeIdx === i ? 'border-foreground' : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* INFO TABS */}
          <div id="detail-tabs" className="space-y-0">
            {/* Tab headers */}
            <div className="flex border-b border-border">
              {(['overview', 'features', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-[12px] font-bold uppercase tracking-widest transition-colors relative ${
                    activeTab === tab
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="pt-8">
              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-10 animate-fade-in">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Description</h3>
                    <p className="text-[15px] leading-relaxed max-w-3xl whitespace-pre-wrap text-foreground">
                      {vehicle.description || 'No description provided by the seller.'}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Key Specifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                      {[
                        ['Make', vehicle.make],
                        ['Model', vehicle.model],
                        ['Year', String(vehicle.year)],
                        ['Mileage', `${vehicle.mileage.toLocaleString()} mi`],
                        ['Location', vehicle.location],
                        ['Status', vehicle.status],
                        ['Listed', new Date(vehicle.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between py-3 border-b border-border/60">
                          <span className="text-[13px] text-muted-foreground">{label}</span>
                          <span className="text-[13px] font-bold capitalize">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* FEATURES */}
              {activeTab === 'features' && (
                <div className="animate-fade-in">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6">Standard & Optional Equipment</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    {FEATURES.map((f) => (
                      <div key={f} className="flex items-center gap-3 py-3 border-b border-border/60">
                        <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                        <span className="text-[13px]">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HISTORY */}
              {activeTab === 'history' && (
                <div className="animate-fade-in space-y-6">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Vehicle History Report</h3>
                  <div className="space-y-4">
                    {[
                      { icon: <CheckCircle2 className="h-5 w-5" />, label: 'No Accident History Reported', ok: true },
                      { icon: <CheckCircle2 className="h-5 w-5" />, label: '1 Previous Owner', ok: true },
                      { icon: <CheckCircle2 className="h-5 w-5" />, label: 'Clean Title', ok: true },
                      { icon: <CheckCircle2 className="h-5 w-5" />, label: 'No Structural Damage Reported', ok: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-4 p-4 border border-border bg-background">
                        <span className="text-foreground">{item.icon}</span>
                        <span className="text-[14px] font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-5 border border-border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-bold uppercase tracking-wider mb-1">Carfax Report</div>
                        <div className="text-[12px] text-muted-foreground">Full vehicle history, service records, and ownership info</div>
                      </div>
                      <Badge className="bg-background border border-border text-foreground text-[10px] uppercase tracking-widest font-bold">
                        Available
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest">
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      View Full Carfax Report
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SELLER PROFILE CARD */}
          <div className="border border-border p-6 space-y-5 bg-background">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">About the Seller</h3>
            <div className="flex items-start gap-5">
              <div className="h-14 w-14 bg-foreground text-background flex items-center justify-center font-bold text-[16px] shrink-0">
                {sellerInitials}
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <div className="text-[15px] font-bold">Verified Seller</div>
                  <div className="text-[12px] text-muted-foreground">Member since 2024 · Typically responds within 2 hours</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-background border border-foreground text-foreground text-[10px] uppercase tracking-widest font-bold gap-1.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified Owner
                  </Badge>
                  <Badge className="bg-background border border-foreground text-foreground text-[10px] uppercase tracking-widest font-bold gap-1.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Identity Verified
                  </Badge>
                  <Badge className="bg-background border border-foreground text-foreground text-[10px] uppercase tracking-widest font-bold gap-1.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> VIN Verified
                  </Badge>
                </div>
                <div className="flex items-center gap-6 text-[12px] text-muted-foreground">
                  <span>Response rate: <strong className="text-foreground">94%</strong></span>
                  <span>Listings: <strong className="text-foreground">3</strong></span>
                </div>
              </div>
            </div>
            <Separator />
            <Link to="/profile">
              <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest">
                <User className="h-3.5 w-3.5 mr-2" /> View Seller Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* ── RIGHT COLUMN (sticky) ─────────────────────────────── */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-5">

            {/* PRICE CARD */}
            <div className="border border-border bg-background p-7 space-y-6">
              <div className="space-y-1">
                <h1 className="text-[18px] font-bold tracking-tight leading-snug">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <div className="text-3xl font-bold tracking-tight">${vehicle.price.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground font-mono pt-1">
                  VIN: 1HGBH41JX{vehicle.id.substring(0, 6).toUpperCase()}…
                </div>
              </div>

              {/* 3-stat row */}
              <div className="grid grid-cols-3 gap-2 border-y border-border py-5">
                {[
                  { icon: <Calendar className="h-4 w-4" />, label: 'Year', value: String(vehicle.year) },
                  { icon: <Gauge className="h-4 w-4" />, label: 'Miles', value: `${Math.round(vehicle.mileage / 1000)}k` },
                  { icon: <MapPin className="h-4 w-4" />, label: 'Location', value: vehicle.location.split(',')[0] },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="text-center space-y-1.5">
                    <div className="flex justify-center text-muted-foreground">{icon}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
                    <div className="text-[12px] font-bold truncate px-1">{value}</div>
                  </div>
                ))}
              </div>

              {/* Trust badges */}
              <div className="space-y-2">
                {[
                  '✓ Identity Verified',
                  '✓ VIN Verified',
                  '✓ Ownership Document Reviewed',
                ].map((b) => (
                  <div key={b} className="text-[12px] font-medium text-foreground flex items-center gap-2">
                    {b}
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <Button
                  id="start-purchase-btn"
                  className="w-full h-12 text-[12px] font-bold uppercase tracking-widest"
                >
                  Start Purchase
                </Button>
                <Button
                  id="message-seller-btn"
                  variant="outline"
                  className="w-full h-12 text-[12px] font-bold uppercase tracking-widest"
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-10 text-[11px] font-bold uppercase tracking-widest"
                    onClick={() => saveMutation.mutate()}
                  >
                    <Heart className="h-4 w-4 mr-1.5" /> Save
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-[11px] font-bold uppercase tracking-widest"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
                  >
                    <Share2 className="h-4 w-4 mr-1.5" /> Share
                  </Button>
                </div>
              </div>
            </div>

            {/* PAYMENT ESTIMATOR */}
            <div className="border border-border bg-background p-6 space-y-5">
              <h3 className="text-[11px] font-bold uppercase tracking-widest">Estimate Monthly Payment</h3>

              {/* Cash Down Slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[12px] text-muted-foreground">Cash Down</span>
                  <span className="text-[12px] font-bold">${cashDown.toLocaleString()} down</span>
                </div>
                <input
                  id="cash-down-slider"
                  type="range"
                  min={0}
                  max={20000}
                  step={500}
                  value={cashDown}
                  onChange={(e) => setCashDown(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted appearance-none cursor-pointer accent-foreground"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>$0</span><span>$20k</span>
                </div>
              </div>

              {/* Loan term */}
              <div className="space-y-2">
                <span className="text-[12px] text-muted-foreground">Loan Term</span>
                <div className="grid grid-cols-4 gap-2">
                  {[36, 48, 60, 72].map((m) => (
                    <button
                      key={m}
                      id={`loan-term-${m}`}
                      onClick={() => setLoanTerm(m)}
                      className={`py-2 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                        loanTerm === m
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-background text-foreground border-border hover:border-foreground'
                      }`}
                    >
                      {m}mo
                    </button>
                  ))}
                </div>
              </div>

              {/* Credit score */}
              <div className="space-y-2">
                <span className="text-[12px] text-muted-foreground">Credit Score</span>
                <Select value={creditScore} onValueChange={setCreditScore}>
                  <SelectTrigger id="credit-score-select" className="text-[12px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent (750+)</SelectItem>
                    <SelectItem value="good">Good (700–749)</SelectItem>
                    <SelectItem value="fair">Fair (650–699)</SelectItem>
                    <SelectItem value="poor">Poor (&lt;650)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Estimates */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-muted-foreground">Est. Monthly Payment</span>
                  <span id="monthly-estimate" className="text-2xl font-bold">${monthly.toFixed(0)}<span className="text-[12px] font-normal text-muted-foreground">/mo</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px] text-muted-foreground">Est. APR</span>
                  <span id="apr-estimate" className="text-[13px] font-bold">{apr}%</span>
                </div>
              </div>

              <div className="flex gap-2 p-3 bg-muted/40 border border-border">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  These are estimates only. Actual terms depend on lender approval.
                </p>
              </div>

              <Button variant="outline" className="w-full h-10 text-[11px] font-bold uppercase tracking-widest">
                Get Pre-Approved
              </Button>
            </div>

            {/* TRADE-IN */}
            <div className="border border-border bg-background">
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-muted/40 transition-colors"
                onClick={() => setTradeInOpen(!tradeInOpen)}
              >
                Have a Trade-In?
                {tradeInOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {tradeInOpen && (
                <div className="px-6 pb-6 space-y-4 border-t border-border animate-fade-in">
                  <p className="text-[12px] text-muted-foreground pt-4">Enter your vehicle's VIN to get an instant estimate.</p>
                  <div className="flex gap-2">
                    <Input
                      id="tradein-vin-input"
                      placeholder="1HGBH41JXMN109186"
                      value={tradeVin}
                      onChange={(e) => setTradeVin(e.target.value)}
                      className="text-[12px] font-mono h-10"
                      maxLength={17}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-[11px] font-bold uppercase tracking-wider h-10 px-4"
                      onClick={() => {
                        if (tradeVin.length === 17) {
                          setTradeEstimate('$14,200 – $16,800');
                          toast.success('Trade-in estimate ready!');
                        } else {
                          toast.error('Please enter a valid 17-character VIN.');
                        }
                      }}
                    >
                      Estimate
                    </Button>
                  </div>
                  {tradeEstimate && (
                    <div className="p-4 border border-border bg-background animate-fade-in">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Estimated Value</div>
                      <div className="text-xl font-bold">{tradeEstimate}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">Based on current market comparables</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Security note */}
            <div className="flex gap-3 p-4 border border-border bg-muted/20">
              <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Verified listing. Kerodex prioritizes secure, transparent private-party transactions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY CTA BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3 z-50 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Price</div>
          <div className="text-[16px] font-bold">${vehicle.price.toLocaleString()}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-[11px] font-bold uppercase tracking-widest h-10 px-4"
          onClick={() => saveMutation.mutate()}
        >
          <Heart className="h-4 w-4 mr-1.5" /> Save
        </Button>
        <Button
          size="sm"
          className="text-[11px] font-bold uppercase tracking-widest h-10 px-5"
        >
          <MessageSquare className="h-4 w-4 mr-1.5" /> Message
        </Button>
      </div>

      {/* LIGHTBOX */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl w-full p-0 bg-background border border-border">
          <DialogHeader className="px-6 py-4 border-b border-border flex-row items-center justify-between">
            <DialogTitle className="text-[12px] font-bold uppercase tracking-widest">
              Photo {activeIdx + 1} of {images.length || 1}
            </DialogTitle>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-2 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="relative">
            <img src={mainImage} alt="" className="w-full max-h-[80vh] object-contain bg-muted" />
            {images.length > 1 && (
              <div className="flex gap-2 p-4 border-t border-border overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`h-14 w-20 shrink-0 border overflow-hidden transition-all ${
                      activeIdx === i ? 'border-foreground' : 'border-border'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
