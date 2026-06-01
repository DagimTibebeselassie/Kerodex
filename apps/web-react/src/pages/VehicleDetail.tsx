import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from '@tanstack/react-router';
import { getVehicle, saveVehicleLocal, savedVehicleIds, startConversation } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
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
  MapPin, Gauge, Calendar, Shield, MessageSquare, Heart, Share2, ArrowLeft,
  CheckCircle2, ChevronDown, ChevronUp, ZoomIn, Car, User, AlertTriangle, X,
  FileText, Clock, Zap, Star, TrendingDown, Camera, Award,
} from 'lucide-react';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_VEHICLE = {
  id: 'demo-v1',
  userId: 'seller-1',
  make: 'BMW',
  model: '3 Series',
  year: 2021,
  price: 42000,
  mileage: 28000,
  location: 'Nashville, TN',
  description:
    'Pristine 2021 BMW 3 Series M Sport package in Alpine White. One owner, always garaged. Full service history at BMW dealership. New Michelin Pilot Sport tires installed March 2026. No accidents, clean title. Selling due to company lease vehicle.',
  images: [
    'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=1200',
    'https://images.unsplash.com/photo-1617814076229-a2284e8c5a29?q=80&w=800',
    'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=800',
    'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?q=80&w=800',
  ],
  status: 'available' as const,
  createdAt: '2026-05-01T00:00:00Z',
};

const FEATURES = [
  'Apple CarPlay / Android Auto', 'Backup Camera', 'Blind Spot Monitoring',
  'Climate Control (Dual Zone)', 'Heated & Ventilated Seats', 'Keyless Entry & Push-Start',
  'Lane Keep Assist', 'Leather Interior', 'Navigation System', 'Panoramic Sunroof',
  'Power Adjustable Seats', 'Premium Sound System', 'Rear Cross-Traffic Alert',
  'Remote Start', 'Wireless Charging',
];

const APR_MAP: Record<string, number> = { excellent: 5.9, good: 8.4, fair: 12.9, poor: 18.9 };

const TIMELINE_ITEMS = [
  { icon: '📅', date: 'March 2021', label: 'Purchased new from BMW of Nashville', category: 'purchase', color: 'bg-primary' },
  { icon: '🔧', date: 'October 2022', label: 'Oil change & inspection — BMW dealership', category: 'service', color: 'bg-muted-foreground' },
  { icon: '🔧', date: 'August 2023', label: 'Brake fluid flush, tire rotation', category: 'service', color: 'bg-muted-foreground' },
  { icon: '🔧', date: 'January 2025', label: 'New front brakes installed', category: 'service', color: 'bg-muted-foreground' },
  { icon: '🛞', date: 'March 2026', label: 'New Michelin Pilot Sport 4S tires', category: 'tires', color: 'bg-foreground' },
  { icon: '📋', date: 'May 2026', label: 'Listed on Kerodex', category: 'listing', color: 'bg-primary' },
];

function calcMonthly(price: number, down: number, months: number, aprPct: number): number {
  const principal = price - down;
  if (principal <= 0) return 0;
  const r = aprPct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Gallery({ images, activeIdx, setActiveIdx, setLightboxOpen, make, model, year }: {
  images: string[]; activeIdx: number; setActiveIdx: (i: number) => void;
  setLightboxOpen: (v: boolean) => void; make: string; model: string; year: number;
}) {
  const mainImage = images[activeIdx] || images[0];
  const thumbs = images.slice(0, 6);
  return (
    <div className="space-y-3">
      <div
        className="relative aspect-video bg-muted border border-border overflow-hidden cursor-zoom-in group"
        onClick={() => setLightboxOpen(true)}
      >
        <img src={mainImage} alt={`${year} ${make} ${model}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
        <div className="absolute bottom-3 left-3 bg-background/90 border border-border px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
          Photo {activeIdx + 1} of {images.length}
        </div>
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border p-2">
          <ZoomIn className="h-4 w-4" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {thumbs.map((img, i) => (
          <button key={i} onClick={() => setActiveIdx(i)}
            className={`aspect-video bg-muted border overflow-hidden transition-all ${activeIdx === i ? 'border-foreground' : 'border-border hover:border-muted-foreground'}`}>
            <img src={img} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function TabNav({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => (
        <button key={tab} onClick={() => onChange(tab)}
          className={`px-6 py-3 text-[12px] font-bold uppercase tracking-widest transition-colors relative ${active === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
          {active === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({ vehicle }: { vehicle: typeof MOCK_VEHICLE }) {
  return (
    <div className="space-y-10 animate-fade-in">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Description</h3>
        <p className="text-[15px] leading-relaxed max-w-3xl whitespace-pre-wrap text-foreground">{vehicle.description}</p>
      </div>
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Key Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
          {[
            ['Make', vehicle.make], ['Model', vehicle.model], ['Year', String(vehicle.year)],
            ['Mileage', `${vehicle.mileage.toLocaleString()} mi`], ['Location', vehicle.location],
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
  );
}

function FeaturesTab() {
  return (
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
  );
}

function HistoryTab() {
  return (
    <div className="animate-fade-in space-y-6">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Vehicle History Report</h3>
      <div className="space-y-4">
        {[
          'No Accident History Reported', '1 Previous Owner', 'Clean Title', 'No Structural Damage Reported',
        ].map((label) => (
          <div key={label} className="flex items-center gap-4 p-4 border border-border bg-background">
            <CheckCircle2 className="h-5 w-5 text-foreground shrink-0" />
            <span className="text-[14px] font-medium">{label}</span>
          </div>
        ))}
      </div>
      {/* Maintenance Records Vault */}
      <div className="p-5 border border-border bg-muted/20 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <div className="text-[13px] font-bold uppercase tracking-wider">Maintenance Records — 6 documents uploaded</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Oil Changes (3) · Brake Work (1) · Inspections (2)</div>
          </div>
        </div>
        <Separator {...({} as any)} />
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-[12px] text-muted-foreground">Documents verified by Kerodex — not publicly shared</p>
        </div>
        <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest">
          <FileText className="h-3.5 w-3.5 mr-2" /> View Summary
        </Button>
      </div>
    </div>
  );
}

function TimelineTab() {
  return (
    <div className="animate-fade-in space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6">Vehicle Story</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-0">
          {TIMELINE_ITEMS.map((item, i) => (
            <div key={i} className="relative flex gap-6 pb-8 last:pb-0">
              <div className={`relative z-10 h-8 w-8 shrink-0 rounded-full ${item.color} flex items-center justify-center text-[14px]`}>
                {item.icon}
              </div>
              <div className="pt-1 space-y-1">
                <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">{item.date}</div>
                <div className="text-[14px] leading-relaxed">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SellerCard({ vehicle }: { vehicle: any }) {
  const seller = vehicle.seller || {};
  const sellerName = seller.name || 'Private seller';
  const initials = seller.initials || sellerName.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();
  const memberSince = seller.memberSince
    ? new Date(seller.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';
  const badges = [
    seller.verified ? 'Identity' : '',
    vehicle.verificationStatus?.includes('ownership') ? 'Ownership' : '',
    vehicle.vin ? 'VIN' : '',
    seller.responseRate ? 'Phone' : '',
  ].filter(Boolean);
  return (
    <div className="border border-border p-6 space-y-5 bg-background">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">About the Seller</h3>
      <div className="flex items-start gap-5">
        <div className="h-14 w-14 bg-foreground text-background flex items-center justify-center font-bold text-[16px] shrink-0 rounded-full">
          {initials}
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-bold">{sellerName}</div>
            {seller.reviewCount > 0 && (
              <div className="flex items-center gap-1 text-[12px] text-amber-500 font-bold">
                <Star className="h-3.5 w-3.5 fill-current" /> {Number(seller.rating || 0).toFixed(1)}
                <span className="text-muted-foreground font-normal">({seller.reviewCount} review{seller.reviewCount === 1 ? '' : 's'})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Member since {memberSince}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 border border-border text-[11px] font-bold uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5 text-amber-500" /> {seller.responseTime || 'Response time not available'}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {badges.map((v) => (
              <Badge key={v} className="bg-background border border-foreground text-foreground text-[10px] uppercase tracking-widest font-bold gap-1 py-1 px-2">
                <CheckCircle2 className="h-3 w-3" /> {v}
              </Badge>
            ))}
            {!badges.length && (
              <Badge className="bg-background border border-border text-muted-foreground text-[10px] uppercase tracking-widest font-bold py-1 px-2">
                Verification pending
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-6 text-[12px] text-muted-foreground pt-1">
            <span>Response rate: <strong className="text-foreground">{seller.responseRate ? `${seller.responseRate}%` : 'New'}</strong></span>
            <span>Completed: <strong className="text-foreground">{seller.completedSales || 0}</strong></span>
          </div>
        </div>
      </div>
      <Separator {...({} as any)} />
      {seller.id ? (
        <Link to="/seller/$id" params={{ id: seller.id }}>
          <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest">
            <User className="h-3.5 w-3.5 mr-2" /> View Seller Profile
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="text-[11px] font-bold uppercase tracking-widest">
          <User className="h-3.5 w-3.5 mr-2" /> Seller Profile Pending
        </Button>
      )}
    </div>
  );
}

function RiskMeter() {
  const checks = [
    { ok: true, label: 'VIN verified' },
    { ok: true, label: 'Ownership documented' },
    { ok: true, label: 'Active seller (listed 3 days ago)' },
    { ok: true, label: 'Multiple photos (8 uploaded)' },
    { ok: false, label: 'No inspection report (optional)', warning: true },
  ];
  return (
    <div className="border border-border bg-background p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Buyer Risk Assessment</h3>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">Low Risk</span>
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full w-[18%] bg-emerald-500 rounded-full" />
      </div>
      <div className="space-y-2.5">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2.5 text-[13px]">
            {c.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span className={c.warning ? 'text-muted-foreground' : ''}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScamWarnings() {
  const [expanded, setExpanded] = useState(false);
  const notices = [
    { warn: true, text: 'Price is 5% below local market — this is unusual but within normal range' },
    { warn: true, text: 'Seller account created 31 days ago — newer account' },
  ];
  const positives = [
    { text: 'No duplicate images detected' },
    { text: 'VIN matches listing details' },
  ];
  return (
    <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[12px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">
            Automated Listing Analysis
          </span>
          {!expanded && (
            <span className="text-[11px] bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 font-bold">
              {notices.length} notices
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3 animate-fade-in border-t border-amber-200 dark:border-amber-900/50 pt-4">
          {notices.map((n, i) => (
            <div key={i} className="flex gap-2.5 text-[13px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              {n.text}
            </div>
          ))}
          <Separator {...({} as any)} className="border-amber-200 dark:border-amber-900/50" />
          {positives.map((p, i) => (
            <div key={i} className="flex gap-2.5 text-[13px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              {p.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketValuePanel({ price }: { price: number }) {
  const fairMarket = 44200;
  const diff = fairMarket - price;
  const isBelow = diff > 0;
  const pct = Math.round((diff / fairMarket) * 100);
  const barWidth = isBelow ? Math.min(40 + (diff / fairMarket) * 60, 80) : 50;
  return (
    <div className="p-4 border border-border bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Fair Market Value</span>
        <span className="text-[13px] font-bold">${fairMarket.toLocaleString()}</span>
      </div>
      <div className={`flex items-center gap-2 text-[12px] font-bold ${isBelow ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
        {isBelow ? <TrendingDown className="h-4 w-4" /> : <TrendingDown className="h-4 w-4 rotate-180" />}
        This listing is ${Math.abs(diff).toLocaleString()} {isBelow ? 'BELOW' : 'ABOVE'} market average
        <span className="text-muted-foreground font-normal">({Math.abs(pct)}%)</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isBelow ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>Below Market</span><span>Fair</span><span>Above</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Based on 23 comparable listings nearby</p>
    </div>
  );
}

function TrustSection() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {['Identity Verified', 'VIN Verified', 'Ownership Verified'].map((b) => (
          <div key={b} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-[11px] font-bold uppercase tracking-wider bg-background">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {b}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Trust Score</span>
          <span className="text-[13px] font-bold">87<span className="text-muted-foreground font-normal">/100</span></span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full w-[87%] bg-emerald-500 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function PhotoChallengeBadge() {
  return (
    <div className="flex items-start gap-3 p-4 border border-border bg-muted/20">
      <Camera className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-primary" />
          Photo Challenge Verified — KX-4827
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Seller uploaded a photo of the vehicle with this code on May 1, 2026, proving current possession.
        </p>
      </div>
    </div>
  );
}

function ListingCompleteness() {
  const pct = 88;
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return (
    <div className="p-4 border border-border bg-background space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Listing Completeness</span>
        <span className="text-[13px] font-bold">{pct}%</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: filled }).map((_, i) => <div key={`f${i}`} className="h-1.5 flex-1 bg-foreground rounded-sm" />)}
        {Array.from({ length: empty }).map((_, i) => <div key={`e${i}`} className="h-1.5 flex-1 bg-muted rounded-sm" />)}
      </div>
      <p className="text-[11px] text-muted-foreground">Suggested: Add inspection report</p>
    </div>
  );
}

function PaymentEstimator({ price }: { price: number }) {
  const [cashDown, setCashDown] = useState(3000);
  const [loanTerm, setLoanTerm] = useState(60);
  const [creditScore, setCreditScore] = useState('good');
  const apr = APR_MAP[creditScore] ?? 8.4;
  const monthly = useMemo(() => calcMonthly(price, cashDown, loanTerm, apr), [price, cashDown, loanTerm, apr]);
  return (
    <div className="border border-border bg-background p-6 space-y-5">
      <h3 className="text-[11px] font-bold uppercase tracking-widest">Estimate Monthly Payment</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-[12px] text-muted-foreground">Cash Down</span>
          <span className="text-[12px] font-bold">${cashDown.toLocaleString()} down</span>
        </div>
        <input type="range" min={0} max={20000} step={500} value={cashDown}
          onChange={(e) => setCashDown(Number(e.target.value))}
          className="w-full h-1.5 bg-muted appearance-none cursor-pointer accent-foreground" />
        <div className="flex justify-between text-[10px] text-muted-foreground"><span>$0</span><span>$20k</span></div>
      </div>
      <div className="space-y-2">
        <span className="text-[12px] text-muted-foreground">Loan Term</span>
        <div className="grid grid-cols-4 gap-2">
          {[36, 48, 60, 72].map((m) => (
            <button key={m} onClick={() => setLoanTerm(m)}
              className={`py-2 text-[11px] font-bold uppercase tracking-wider border transition-colors ${loanTerm === m ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground border-border hover:border-foreground'}`}>
              {m}mo
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-[12px] text-muted-foreground">Credit Score</span>
        <Select value={creditScore} onValueChange={setCreditScore}>
          <SelectTrigger {...({} as any)} className="text-[12px] h-10"><SelectValue /></SelectTrigger>
          <SelectContent {...({} as any)}>
            <SelectItem {...({} as any)} value="excellent">Excellent (750+)</SelectItem>
            <SelectItem {...({} as any)} value="good">Good (700–749)</SelectItem>
            <SelectItem {...({} as any)} value="fair">Fair (650–699)</SelectItem>
            <SelectItem {...({} as any)} value="poor">Poor (&lt;650)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator {...({} as any)} />
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-[12px] text-muted-foreground">Est. Monthly Payment</span>
          <span className="text-2xl font-bold">${monthly.toFixed(0)}<span className="text-[12px] font-normal text-muted-foreground">/mo</span></span>
        </div>
        <div className="flex justify-between">
          <span className="text-[12px] text-muted-foreground">Est. APR</span>
          <span className="text-[13px] font-bold">{apr}%</span>
        </div>
      </div>
      <div className="flex gap-2 p-3 bg-muted/40 border border-border">
        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">These are estimates only. Actual terms depend on lender approval.</p>
      </div>
      <Button variant="outline" className="w-full h-10 text-[11px] font-bold uppercase tracking-widest">Get Pre-Approved</Button>
    </div>
  );
}

function TradeIn() {
  const [open, setOpen] = useState(false);
  const [vin, setVin] = useState('');
  const [estimate, setEstimate] = useState<string | null>(null);
  return (
    <div className="border border-border bg-background">
      <button className="w-full flex items-center justify-between px-6 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(!open)}>
        Have a Trade-In?
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-border animate-fade-in">
          <p className="text-[12px] text-muted-foreground pt-4">Enter your vehicle's VIN to get an instant estimate.</p>
          <div className="flex gap-2">
            <Input placeholder="1HGBH41JXMN109186" value={vin} onChange={(e) => setVin(e.target.value)}
              className="text-[12px] font-mono h-10" maxLength={17} />
            <Button variant="outline" size="sm" className="shrink-0 text-[11px] font-bold uppercase tracking-wider h-10 px-4"
              onClick={() => {
                if (vin.length === 17) { setEstimate('$14,200 – $16,800'); toast.success('Trade-in estimate ready!'); }
                else toast.error('Please enter a valid 17-character VIN.');
              }}>
              Estimate
            </Button>
          </div>
          {estimate && (
            <div className="p-4 border border-border bg-background animate-fade-in">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Estimated Value</div>
              <div className="text-xl font-bold">{estimate}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Based on current market comparables</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function VehicleDetailPage() {
  const { id } = useParams({ from: '/vehicle/$id' });
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [vehicle, setVehicle] = useState<typeof MOCK_VEHICLE>({ ...MOCK_VEHICLE, id: id || MOCK_VEHICLE.id });

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'history' | 'timeline'>('overview');
  const [isSaved, setIsSaved] = useState(savedVehicleIds().has(id || MOCK_VEHICLE.id));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getVehicle(id)
      .then((remote) => {
        if (!alive) return;
        setVehicle({
          ...MOCK_VEHICLE,
          ...remote,
          images: remote.images.length ? remote.images : MOCK_VEHICLE.images,
          status: remote.status === 'sold' ? 'sold' : 'available',
        } as typeof MOCK_VEHICLE);
        setIsSaved(savedVehicleIds().has(id));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [id]);

  const images = vehicle.images;
  const mainImage = images[activeIdx] || images[0];
  const handleMessageSeller = async () => {
    if (!user) {
      login();
      return;
    }
    try {
      await startConversation(vehicle.id);
      toast.success('Message thread opened.');
      navigate({ to: '/messages' });
    } catch (error: any) {
      toast.error(error.message || 'Unable to open message thread.');
    }
  };

  return (
    <div className="animate-fade-in px-4 lg:px-8 py-10 max-w-screen-2xl mx-auto pb-24 md:pb-10">
      {/* Back nav */}
      <Link to="/search"
        className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 group">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-16">

        {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-10">

          <Gallery images={images} activeIdx={activeIdx} setActiveIdx={setActiveIdx}
            setLightboxOpen={setLightboxOpen} make={vehicle.make} model={vehicle.model} year={vehicle.year} />

          {/* Tabs */}
          <div className="space-y-0">
            <TabNav tabs={['overview', 'features', 'history', 'timeline']} active={activeTab}
              onChange={(t) => setActiveTab(t as typeof activeTab)} />
            <div className="pt-8">
              {activeTab === 'overview' && <OverviewTab vehicle={vehicle} />}
              {activeTab === 'features' && <FeaturesTab />}
              {activeTab === 'history' && <HistoryTab />}
              {activeTab === 'timeline' && <TimelineTab />}
            </div>
          </div>

          <SellerCard vehicle={vehicle} />
          <RiskMeter />
          <ScamWarnings />
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

              <MarketValuePanel price={vehicle.price} />
              <TrustSection />

              {/* CTAs */}
              <div className="space-y-3">
                <Button className="w-full h-12 text-[12px] font-bold uppercase tracking-widest"
                  onClick={handleMessageSeller}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline"
                    className={`h-10 text-[11px] font-bold uppercase tracking-widest ${isSaved ? 'border-primary text-primary' : ''}`}
                    onClick={() => {
                      const next = !isSaved;
                      setIsSaved(next);
                      saveVehicleLocal(vehicle.id, next);
                      toast.success(next ? 'Saved to your collection.' : 'Removed from saved.');
                    }}>
                    <Heart className={`h-4 w-4 mr-1.5 ${isSaved ? 'fill-current' : ''}`} />
                    {isSaved ? 'Saved' : 'Save'}
                  </Button>
                  <Button variant="outline" className="h-10 text-[11px] font-bold uppercase tracking-widest"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}>
                    <Share2 className="h-4 w-4 mr-1.5" /> Share
                  </Button>
                </div>
                <button className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 text-center pt-1"
                  onClick={() => toast.success('Message sent to seller!')}>
                  Is this still available?
                </button>
              </div>
            </div>

            <PhotoChallengeBadge />
            <ListingCompleteness />
            <PaymentEstimator price={vehicle.price} />
            <TradeIn />

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
        <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest h-10 px-4"
          onClick={() => {
            const next = !isSaved;
            setIsSaved(next);
            saveVehicleLocal(vehicle.id, next);
            toast.success(next ? 'Saved!' : 'Removed.');
          }}>
          <Heart className={`h-4 w-4 mr-1.5 ${isSaved ? 'fill-current text-primary' : ''}`} /> Save
        </Button>
        <Button size="sm" className="text-[11px] font-bold uppercase tracking-widest h-10 px-5"
          onClick={handleMessageSeller}>
          <MessageSquare className="h-4 w-4 mr-1.5" /> Message
        </Button>
      </div>

      {/* LIGHTBOX */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent {...({} as any)} className="max-w-5xl w-full p-0 bg-background border border-border">
          <DialogHeader className="px-6 py-4 border-b border-border flex-row items-center justify-between">
            <DialogTitle {...({} as any)} className="text-[12px] font-bold uppercase tracking-widest">
              Photo {activeIdx + 1} of {images.length}
            </DialogTitle>
            <button onClick={() => setLightboxOpen(false)} className="p-2 hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="relative">
            <img src={mainImage} alt="" className="w-full max-h-[80vh] object-contain bg-muted" />
            {images.length > 1 && (
              <div className="flex gap-2 p-4 border-t border-border overflow-x-auto">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveIdx(i)}
                    className={`h-14 w-20 shrink-0 border overflow-hidden transition-all ${activeIdx === i ? 'border-foreground' : 'border-border'}`}>
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
