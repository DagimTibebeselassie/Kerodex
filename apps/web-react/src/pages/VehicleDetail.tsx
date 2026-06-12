import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from '@tanstack/react-router';
import { createReport, createUploadUrl, getVehicle, saveVehicleLocal, savedVehicleIds, startConversation, updateVehicle } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Vehicle } from '@/types';
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
} from '@/components/ui';
import {
  MapPin, Gauge, Calendar, Shield, MessageSquare, Heart, Share2, ArrowLeft,
  CheckCircle2, ChevronDown, ChevronUp, ZoomIn, Car, User, AlertTriangle, X,
  FileText, Clock, Zap, Star, TrendingDown, Camera, Award, Flag,
} from 'lucide-react';

const APR_MAP: Record<string, number> = { excellent: 5.9, good: 8.4, fair: 12.9, poor: 18.9 };


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
  const hasImages = Boolean(mainImage);
  return (
    <div className="space-y-3">
      <div
        className="relative aspect-video bg-muted border border-border overflow-hidden cursor-zoom-in group"
        onClick={() => hasImages && setLightboxOpen(true)}
      >
        {hasImages ? (
          <img src={mainImage} alt={`${year} ${make} ${model}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Camera className="h-8 w-8" />
            <div className="text-[12px] font-bold uppercase tracking-widest">No photos uploaded yet</div>
          </div>
        )}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors" />
        {hasImages && (
          <>
            <div className="absolute bottom-3 left-3 bg-background/90 border border-border px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
              Photo {activeIdx + 1} of {images.length}
            </div>
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border p-2">
              <ZoomIn className="h-4 w-4" />
            </div>
          </>
        )}
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

function OverviewTab({ vehicle }: { vehicle: Vehicle }) {
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

function FeaturesTab({ vehicle }: { vehicle: Vehicle }) {
  const features = Array.isArray(vehicle.features) ? vehicle.features.filter(Boolean) : [];
  return (
    <div className="animate-fade-in">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6">Standard & Optional Equipment</h3>
      {features.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-3 py-3 border-b border-border/60">
              <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
              <span className="text-[13px]">{f}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-5 border border-border bg-muted/20 text-[13px] text-muted-foreground">
          No features were added by this seller yet.
        </div>
      )}
    </div>
  );
}

function HistoryTab({ vehicle }: { vehicle: Vehicle }) {
  const maintenanceRecords = Array.isArray(vehicle.maintenanceRecords)
    ? vehicle.maintenanceRecords.filter(Boolean)
    : [];
  const historyItems = [
    vehicle.accidentHistory,
    vehicle.ownerCount,
    vehicle.titleStatus,
  ].filter(Boolean) as string[];
  const maintenanceNames = Array.isArray(vehicle.maintenanceNames)
    ? vehicle.maintenanceNames.filter(Boolean)
    : [];
  const maintenanceCount = maintenanceRecords.length || maintenanceNames.length;
  const groupedMaintenance = maintenanceRecords.reduce<Record<string, number>>((groups, record: any) => {
    const type = String(record.type || 'Other');
    groups[type] = (groups[type] || 0) + 1;
    return groups;
  }, {});
  const maintenanceSummary = Object.entries(groupedMaintenance)
    .map(([type, count]) => `${type} (${count})`)
    .join(' | ');
  const checkedMaintenanceCount = maintenanceRecords.filter((record: any) =>
    Boolean(record.ocr_processed_at || record.ocrProcessedAt) &&
    ['looks_like_maintenance_record', 'needs_review', 'rejected_unrelated'].includes(documentStatus(record))
  ).length;
  const titleDoc = (vehicle as any).titleDocument;
  const titleDocStatus = documentStatus(titleDoc);

  return (
    <div className="animate-fade-in space-y-6">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Vehicle History Report</h3>
      {historyItems.length > 0 ? (
        <div className="space-y-4">
          {historyItems.map((label) => (
            <div key={label} className="flex items-center gap-4 p-4 border border-border bg-background">
              <CheckCircle2 className="h-5 w-5 text-foreground shrink-0" />
              <span className="text-[14px] font-medium">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-5 border border-border bg-muted/20 text-[13px] text-muted-foreground">
          No seller history disclosures have been added yet.
        </div>
      )}
      <div className="p-5 border border-border bg-muted/20 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <div className="text-[13px] font-bold uppercase tracking-wider">
              Maintenance Records - {maintenanceCount} document{maintenanceCount === 1 ? '' : 's'} uploaded
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {maintenanceSummary || (maintenanceNames.length ? maintenanceNames.join(' | ') : 'No maintenance documents uploaded yet')}
            </div>
          </div>
        </div>
        <Separator {...({} as any)} />
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-[12px] text-muted-foreground" title={DOCUMENT_CHECK_TOOLTIP}>
            Seller-uploaded documents are private and only summaries are shown publicly.
            {checkedMaintenanceCount ? ` ${checkedMaintenanceCount} maintenance document${checkedMaintenanceCount === 1 ? '' : 's'} checked by automated OCR.` : ''}
          </p>
        </div>
        {titleDoc && (
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[12px] text-muted-foreground" title={DOCUMENT_CHECK_TOOLTIP}>
              {titleDocStatus === 'title_vin_matches_listing'
                ? 'VIN on uploaded title matches listing.'
                : titleDocStatus === 'title_vin_mismatch'
                  ? 'Uploaded title document needs review because the VIN check did not match.'
                  : 'Title document uploaded; automated check is pending or needs review.'}
            </p>
          </div>
        )}
        {maintenanceCount > 0 && (
          <Button variant="outline" size="sm" className="text-[11px] font-bold uppercase tracking-widest">
            <FileText className="h-3.5 w-3.5 mr-2" /> View Summary
          </Button>
        )}
      </div>
    </div>
  );
}

function TimelineTab({ vehicle }: { vehicle: Vehicle }) {
  const maintenanceEvents = Array.isArray(vehicle.maintenanceRecords)
    ? vehicle.maintenanceRecords
        .filter((record: any) => record.date || record.type || record.notes)
        .map((record: any) => ({
          date: record.date || '',
          label: [record.type || 'Maintenance', record.notes || record.name].filter(Boolean).join(' - '),
        }))
    : [];
  const savedEvents = Array.isArray(vehicle.historyTimeline)
    ? vehicle.historyTimeline
        .filter((event: any) => event.title || event.notes || event.date)
        .map((event: any) => ({
          date: event.date || '',
          label: [event.title, event.notes].filter(Boolean).join(' - '),
        }))
    : [];
  const timelineItems = [
    ...savedEvents,
    ...maintenanceEvents,
    ...(Array.isArray(vehicle.historyHighlights) ? vehicle.historyHighlights.filter(Boolean).map((label: string) => ({ date: '', label })) : []),
    { date: vehicle.createdAt, label: `Listed on Kerodex in ${vehicle.location}` },
  ];

  return (
    <div className="animate-fade-in space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6">Vehicle Story</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-0">
          {timelineItems.map((label, i) => (
            <div key={i} className="relative flex gap-6 pb-8 last:pb-0">
              <div className="relative z-10 h-8 w-8 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center text-[12px] font-bold">
                {i + 1}
              </div>
              <div className="pt-1 space-y-1">
                <div className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                  {timelineItems[i].date
                    ? new Date(timelineItems[i].date.length === 7 ? `${timelineItems[i].date}-01` : timelineItems[i].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : 'Seller disclosure'}
                </div>
                <div className="text-[14px] leading-relaxed">{label.label}</div>
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
    hasOwnershipVerified(vehicle) ? 'Ownership' : '',
    hasVinVerified(vehicle) ? 'VIN' : '',
    seller.phoneVerified ? 'Phone' : '',
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
function daysAgo(value?: string): number | null {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function ageLabel(value?: string): string {
  const days = daysAgo(value);
  if (days === null) return 'date unavailable';
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function verificationText(vehicle: any): string {
  return [
    vehicle.verificationStatus,
    ...(vehicle.badges || []),
    ...(vehicle.historyHighlights || []),
  ].join(' ').toLowerCase();
}

function hasVinVerified(vehicle: any): boolean {
  return Boolean(vehicle.marketCheckVin && !vehicle.marketCheckDecodeError);
}

function hasOwnershipVerified(vehicle: any): boolean {
  const text = verificationText(vehicle);
  return (text.includes('ownership verified') || text.includes('ownership reviewed')) && !text.includes('pending');
}

function hasPhotoChallenge(vehicle: any): boolean {
  return Boolean(vehicle.photoChallengeVerified || vehicle.livePhotoVerified || vehicle.challengeCodeVerified);
}

function hasInspection(vehicle: any): boolean {
  const text = verificationText(vehicle);
  return Boolean(vehicle.inspectionVerified || text.includes('inspection verified') || text.includes('inspection complete'));
}

function hasCleanTitleDisclosure(vehicle: any): boolean {
  return String(vehicle.titleStatus || '').toLowerCase().includes('clean');
}

function hasNoAccidentDisclosure(vehicle: any): boolean {
  return String(vehicle.accidentHistory || '').toLowerCase().includes('no accident');
}

function listingCompletenessScore(vehicle: any): { pct: number; suggestions: string[] } {
  const checks = [
    { ok: Boolean(vehicle.vin), suggestion: 'Add VIN' },
    { ok: hasVinVerified(vehicle), suggestion: 'Verify VIN' },
    { ok: Boolean(vehicle.images?.length), suggestion: 'Add photos' },
    { ok: Number(vehicle.images?.length || 0) >= 5, suggestion: 'Add 5+ photos' },
    { ok: Boolean(vehicle.description), suggestion: 'Add description' },
    { ok: Boolean(vehicle.titleStatus), suggestion: 'Disclose title status' },
    { ok: Boolean(vehicle.accidentHistory), suggestion: 'Disclose accident history' },
    { ok: Boolean(vehicle.ownerCount), suggestion: 'Disclose ownership history' },
    { ok: Boolean(vehicle.features?.length), suggestion: 'Add features' },
    { ok: Boolean(vehicle.maintenanceNames?.length), suggestion: 'Upload maintenance records' },
  ];
  const passed = checks.filter((item) => item.ok).length;
  return {
    pct: Math.round((passed / checks.length) * 100),
    suggestions: checks.filter((item) => !item.ok).map((item) => item.suggestion).slice(0, 2),
  };
}

function trustScore(vehicle: any): number {
  let score = 20;
  if (vehicle.seller?.verified) score += 20;
  if (hasVinVerified(vehicle)) score += 20;
  if (hasOwnershipVerified(vehicle)) score += 15;
  if (hasPhotoChallenge(vehicle)) score += 10;
  if (hasInspection(vehicle)) score += 10;
  if (Number(vehicle.images?.length || 0) >= 5) score += 5;
  if (vehicle.maintenanceNames?.length) score += 5;
  return Math.min(100, score);
}

function riskLevel(score: number): { label: string; bar: string; text: string; width: string } {
  if (score >= 75) return { label: 'Lower Risk', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', width: '25%' };
  if (score >= 45) return { label: 'Medium Risk', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', width: '55%' };
  return { label: 'Higher Risk', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', width: '82%' };
}

function priceAnalysis(vehicle: Vehicle): { text: string; tone: 'good' | 'warn' | 'neutral'; diff: number; pct: number } | null {
  const marketValue = Number(vehicle.marketValue || 0);
  if (!marketValue || !Number.isFinite(marketValue)) return null;
  const diff = marketValue - vehicle.price;
  const pct = Math.round(Math.abs((diff / marketValue) * 100));
  const source = vehicle.marketValueSource || 'saved market data';
  if (diff > 0) {
    return {
      diff,
      pct,
      tone: diff / marketValue > 0.25 ? 'warn' : 'good',
      text: `Price is ${pct}% below saved market value (${source})`,
    };
  }
  if (diff < 0) {
    return {
      diff,
      pct,
      tone: Math.abs(diff) / marketValue > 0.15 ? 'warn' : 'neutral',
      text: `Price is ${pct}% above saved market value (${source})`,
    };
  }
  return { diff, pct: 0, tone: 'good', text: `Price matches saved market value (${source})` };
}

function isRecent(value?: string, days = 14): boolean {
  const age = daysAgo(value);
  return age !== null && age <= days;
}

function displayVin(vehicle: Vehicle): string {
  const vin = (vehicle as any).vin || '';
  if (!vin) return 'Not provided';
  if (vin.length <= 8) return vin;
  return `${vin.slice(0, 8)}...${vin.slice(-4)}`;
}

const DOCUMENT_CHECK_TOOLTIP =
  'Kerodex uses automated document checks to determine whether an uploaded file appears to match the selected document type. This does not guarantee that the document is authentic, accurate, current, or legally valid.';
const VEHICLE_PRESENCE_TOOLTIP =
  'Kerodex verified that a recent photo containing both the vehicle VIN and a listing-specific verification code was uploaded. This confirms recent physical access to the vehicle but does not guarantee ownership, title status, condition, authenticity, or legal validity.';

function documentStatus(document: any): string {
  return String(document?.document_check_status || document?.documentCheckStatus || '');
}

function documentCheckBadges(vehicle: Vehicle): string[] {
  const records = Array.isArray(vehicle.maintenanceRecords) ? vehicle.maintenanceRecords : [];
  const hasCheckedMaintenance = records.some((record: any) =>
    Boolean(record.ocr_processed_at || record.ocrProcessedAt) &&
    ['looks_like_maintenance_record', 'needs_review', 'rejected_unrelated'].includes(documentStatus(record))
  );
  const titleDoc = (vehicle as any).titleDocument;
  return [
    hasCheckedMaintenance ? 'Maintenance document uploaded - document type checked' : '',
    titleDoc ? 'Title document uploaded' : '',
    documentStatus(titleDoc) === 'title_vin_matches_listing' ? 'VIN on uploaded title matches listing' : '',
  ].filter(Boolean);
}

function RiskMeter({ vehicle }: { vehicle: Vehicle }) {
  const score = trustScore(vehicle);
  const level = riskLevel(score);
  const photos = Number(vehicle.images?.length || 0);
  const checks = [
    { ok: hasVinVerified(vehicle), label: hasVinVerified(vehicle) ? 'VIN verified' : ((vehicle as any).vin ? 'VIN submitted, provider verification pending' : 'VIN not verified') },
    { ok: hasOwnershipVerified(vehicle), label: hasOwnershipVerified(vehicle) ? 'Ownership document reviewed' : 'Ownership document not reviewed yet' },
    { ok: documentStatus((vehicle as any).titleDocument) === 'title_vin_matches_listing', label: documentStatus((vehicle as any).titleDocument) === 'title_vin_matches_listing' ? 'VIN on uploaded title matches listing' : ((vehicle as any).titleDocument ? 'Uploaded title document needs review' : 'No title document uploaded'), warning: documentStatus((vehicle as any).titleDocument) !== 'title_vin_matches_listing' },
    { ok: true, label: `Listed ${ageLabel(vehicle.createdAt)}` },
    { ok: photos >= 5, label: photos >= 5 ? `Multiple photos (${photos} uploaded)` : `${photos} photo${photos === 1 ? '' : 's'} uploaded` },
    { ok: hasInspection(vehicle), label: hasInspection(vehicle) ? 'Inspection report verified' : 'No inspection report (optional)', warning: !hasInspection(vehicle) },
  ];
  return (
    <div className="border border-border bg-background p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Buyer Risk Assessment</h3>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${level.bar}`} />
          <span className={`text-[12px] font-bold ${level.text}`}>{level.label}</span>
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${level.bar} rounded-full`} style={{ width: level.width }} />
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

function ScamWarnings({ vehicle }: { vehicle: Vehicle }) {
  const [expanded, setExpanded] = useState(false);
  const sellerDays = daysAgo(vehicle.seller?.memberSince);
  const listingDays = daysAgo(vehicle.createdAt);
  const valuationDays = daysAgo(vehicle.marketValueDate);
  const comparableCount = Number(vehicle.marketValueComparableCount || 0);
  const marketRadius = Number(vehicle.marketValueRadius || 0);
  const pricing = priceAnalysis(vehicle);
  const allNotices = [
    sellerDays !== null && sellerDays < 7 ? `Seller account is new (${ageLabel(vehicle.seller?.memberSince)})` : '',
    sellerDays !== null && listingDays !== null && sellerDays < 7 && listingDays < 2
      ? 'New seller and newly published listing; consider waiting for more verification signals'
      : '',
    !hasOwnershipVerified(vehicle) ? 'Ownership document has not been reviewed yet' : '',
    !hasPhotoChallenge(vehicle) ? 'Photo challenge has not been completed yet' : '',
    (vehicle as any).vin && !hasVinVerified(vehicle) ? 'VIN was submitted but provider verification is not saved yet' : '',
    documentStatus((vehicle as any).titleDocument) === 'title_vin_mismatch' ? 'Uploaded title document contains a VIN that does not match this listing' : '',
    documentStatus((vehicle as any).titleDocument) === 'title_needs_review' ? 'Uploaded title document needs manual review' : '',
    !vehicle.marketValue ? 'No saved market valuation is attached to this listing yet' : '',
    valuationDays !== null && valuationDays > 14 ? `Market valuation is ${valuationDays} days old` : '',
    comparableCount > 0 && comparableCount < 5 ? `Market value is based on a limited comparable set (${comparableCount})` : '',
    marketRadius > 100 ? `Pricing used a wider market radius (${marketRadius} miles)` : '',
    !vehicle.titleStatus ? 'Title status has not been disclosed by the seller' : '',
    !vehicle.accidentHistory ? 'Accident history has not been disclosed by the seller' : '',
    !vehicle.ownerCount ? 'Ownership history has not been disclosed by the seller' : '',
    (vehicle as any).marketCheckDecodeError ? `VIN provider issue: ${(vehicle as any).marketCheckDecodeError}` : '',
    pricing?.tone === 'warn' ? pricing.text : '',
  ].filter(Boolean);
  const allPositives = [
    pricing && pricing.tone !== 'warn' ? pricing.text : '',
    hasVinVerified(vehicle) ? 'VIN decode is saved from the provider for this listing' : '',
    vehicle.marketValue && isRecent(vehicle.marketValueDate, 14) ? `Market valuation refreshed ${ageLabel(vehicle.marketValueDate)}` : '',
    comparableCount >= 10 ? `Market value is supported by ${comparableCount} comparable listings` : '',
    sellerDays !== null && sellerDays >= 90 ? `Seller account has been active for ${ageLabel(vehicle.seller?.memberSince)}` : '',
    hasOwnershipVerified(vehicle) ? 'Ownership review is complete' : '',
    documentStatus((vehicle as any).titleDocument) === 'title_vin_matches_listing' ? 'VIN on uploaded title matches this listing' : '',
    documentCheckBadges(vehicle).includes('Maintenance document uploaded - document type checked') ? 'Maintenance document type check is saved for this listing' : '',
    hasPhotoChallenge(vehicle) ? 'Live photo challenge is complete' : '',
    hasCleanTitleDisclosure(vehicle) && hasNoAccidentDisclosure(vehicle) ? 'Seller disclosures report clean title and no accident history' : '',
    vehicle.maintenanceRecords?.length ? 'Maintenance record metadata is saved with this listing' : '',
    vehicle.historyTimeline?.length ? 'Vehicle history timeline is seller-provided' : '',
  ].filter(Boolean);
  const analysisNotices = allNotices.slice(0, 4);
  const analysisPositives = allPositives.slice(0, analysisNotices.length ? 2 : 4);
  const summaryText = analysisNotices.length
    ? `${analysisNotices.length} notice${analysisNotices.length === 1 ? '' : 's'}`
    : `${analysisPositives.length || 1} check${analysisPositives.length === 1 ? '' : 's'}`;
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
              {summaryText}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3 animate-fade-in border-t border-amber-200 dark:border-amber-900/50 pt-4">
          {analysisNotices.length === 0 && analysisPositives.length === 0 && (
            <div className="flex gap-2.5 text-[13px] text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              No automated issues were found for the saved listing data.
            </div>
          )}
          {analysisNotices.map((text, i) => (
            <div key={i} className="flex gap-2.5 text-[13px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              {text}
            </div>
          ))}
          {analysisNotices.length > 0 && analysisPositives.length > 0 && (
            <Separator {...({} as any)} className="border-amber-200 dark:border-amber-900/50" />
          )}
          {analysisPositives.map((text, i) => (
            <div key={i} className="flex gap-2.5 text-[13px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              {text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketValuePanel({ vehicle }: { vehicle: Vehicle }) {
  const price = vehicle.price;
  const fairMarket = Number(vehicle.marketValue || 0);
  if (!fairMarket || !Number.isFinite(fairMarket)) {
    const valuationError = (vehicle as any).marketCheckValuationError;
    const pendingReason = valuationError
      ? `MarketCheck did not return a saved valuation: ${valuationError}`
      : vehicle.vin
        ? 'MarketCheck VIN data may be saved, but pricing did not return a usable market value yet.'
        : 'A VIN is required before Kerodex can request and save a market valuation.';
    return (
      <div className="p-4 border border-border bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Fair Market Value</span>
          <span className="text-[13px] font-bold">Pending</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {pendingReason}
        </p>
      </div>
    );
  }
  const diff = fairMarket - price;
  const isBelow = diff > 0;
  const pct = Math.round((diff / fairMarket) * 100);
  const barWidth = isBelow ? Math.min(40 + (diff / fairMarket) * 60, 80) : 50;
  const comparableCount = Number(vehicle.marketValueComparableCount || 0);
  const valuationDate = vehicle.marketValueDate
    ? new Date(vehicle.marketValueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
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
      <p className="text-[11px] text-muted-foreground">
        {`Saved ${vehicle.marketValueSource || 'market'} valuation${valuationDate ? ` from ${valuationDate}` : ''}${comparableCount ? `, based on ${comparableCount} comparable listings` : ''}.`}
      </p>
    </div>
  );
}

function TrustSection({ vehicle }: { vehicle: Vehicle }) {
  const score = trustScore(vehicle);
  const safeDocumentBadges = documentCheckBadges(vehicle);
  const badges = [
    vehicle.seller?.verified ? 'Identity Verified' : '',
    hasVinVerified(vehicle) ? 'VIN Verified' : '',
    hasOwnershipVerified(vehicle) ? 'Ownership document reviewed' : '',
    hasPhotoChallenge(vehicle) ? 'Vehicle Presence Verified' : '',
    hasInspection(vehicle) ? 'Inspection Verified' : '',
    ...safeDocumentBadges,
  ].filter(Boolean);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <div
            key={b}
            title={safeDocumentBadges.includes(b) ? DOCUMENT_CHECK_TOOLTIP : b === 'Vehicle Presence Verified' ? VEHICLE_PRESENCE_TOOLTIP : undefined}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-[11px] font-bold uppercase tracking-wider bg-background"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {b}
          </div>
        ))}
        {!badges.length && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-[11px] font-bold uppercase tracking-wider bg-background text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Verification Pending
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Trust Score</span>
          <span className="text-[13px] font-bold">{score}<span className="text-muted-foreground font-normal">/100</span></span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

function PhotoChallengeBadge({
  vehicle,
  currentUserId,
  onComplete,
  completing,
}: {
  vehicle: Vehicle;
  currentUserId?: string;
  onComplete: (file: File) => void;
  completing: boolean;
}) {
  const verified = hasPhotoChallenge(vehicle);
  const code = (vehicle as any).photoChallengeCode || (vehicle as any).challengeCode || `KX-${String(vehicle.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;
  const canComplete = Boolean(currentUserId && vehicle.userId === currentUserId && !verified);
  const inputId = `photo-challenge-${vehicle.id}`;
  return (
    <div className="flex items-start gap-3 p-4 border border-border bg-muted/20">
      <Camera className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          {verified ? <Award className="h-3.5 w-3.5 text-primary" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          {verified ? `Vehicle Presence Verified - ${code}` : 'Vehicle Presence Verification Pending'}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          {verified
            ? 'Kerodex verified that a recent photo containing both the vehicle VIN and a listing-specific verification code was uploaded. This confirms recent physical access to the vehicle but does not guarantee ownership, title status, condition, authenticity, or legal validity.'
            : canComplete
              ? `This listing needs a new VIN/code verification photo with code ${code}. Edit the listing to upload a fresh verification photo.`
              : 'Seller has not completed vehicle presence verification yet.'}
        </p>
        {canComplete && (
          <Link
            to="/sell"
            search={{ edit: vehicle.id } as any}
            className="mt-3 inline-flex h-9 items-center justify-center border border-border px-4 text-[11px] font-bold uppercase tracking-widest hover:border-foreground transition-colors"
          >
            Upload New Verification Photo
          </Link>
        )}
      </div>
    </div>
  );
}

function ListingCompleteness({ vehicle }: { vehicle: Vehicle }) {
  const { pct, suggestions } = listingCompletenessScore(vehicle);
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
      <p className="text-[11px] text-muted-foreground">
        {suggestions.length ? `Suggested: ${suggestions.join(', ')}` : 'All core listing details are complete.'}
      </p>
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
                if (vin.length === 17) {
                  setEstimate('Trade-in valuation is not connected yet.');
                  toast.success('VIN accepted. Trade-in valuation will be available after provider setup.');
                  return;
                }
                toast.error('Please enter a valid 17-character VIN.');
              }}>
              Estimate
            </Button>
          </div>
          {estimate && (
            <div className="p-4 border border-border bg-background animate-fade-in">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Trade-In Status</div>
              <div className="text-xl font-bold">{estimate}</div>
              <div className="text-[11px] text-muted-foreground mt-1">No trade-in price is shown until a backend valuation provider is connected.</div>
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
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleError, setVehicleError] = useState('');

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'history' | 'timeline'>('overview');
  const [isSaved, setIsSaved] = useState(savedVehicleIds().has(id || ''));
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getVehicle(id)
      .then((remote) => {
        if (!alive) return;
        setVehicle({
          ...remote,
          status: remote.status === 'sold' ? 'sold' : 'available',
        } as Vehicle);
        setIsSaved(savedVehicleIds().has(id));
      })
      .catch((error) => {
        if (!alive) return;
        setVehicleError(error.message || 'Unable to load this listing.');
      });
    return () => { alive = false; };
  }, [id]);

  if (!vehicle) {
    return (
      <div className="px-6 py-24 max-w-screen-xl mx-auto">
        <button onClick={() => navigate({ to: '/search' })} className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>
        <div className="border border-border bg-background p-10 text-center">
          <Car className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-bold mb-2">{vehicleError ? 'Listing unavailable' : 'Loading listing...'}</h1>
          <p className="text-[13px] text-muted-foreground">{vehicleError || 'Fetching listing data from Kerodex.'}</p>
        </div>
      </div>
    );
  }

  const images = vehicle.images;
  const mainImage = images[activeIdx] || images[0];
  const requireSignedInSave = () => {
    if (!user) {
      login();
      toast.error('Sign in to save vehicles.');
      return false;
    }
    return true;
  };
  const toggleSaved = (short = false) => {
    if (!requireSignedInSave()) return;
    const next = !isSaved;
    setIsSaved(next);
    saveVehicleLocal(vehicle.id, next);
    toast.success(next ? (short ? 'Saved!' : 'Saved to your collection.') : 'Removed from saved.');
  };
  const handlePhotoChallengeUpload = async (file: File) => {
    if (!user || vehicle.userId !== user.id) {
      toast.error('Only the seller can complete the photo challenge.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Upload an image file for the photo challenge.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} is too large (max 10 MB).`);
      return;
    }
    setChallengeSubmitting(true);
    try {
      const upload = await createUploadUrl(file.name, file.type, { purpose: 'vehicle-presence', fileSize: file.size });
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers || { 'content-type': file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`S3 upload failed for ${file.name}.`);
      const proofUrl = upload.publicUrl;
      const code = (vehicle as any).photoChallengeCode || (vehicle as any).challengeCode || `KX-${String(vehicle.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;
      const updated = await updateVehicle(vehicle.id, {
        photoChallengeCode: code,
        challengeCode: code,
        photoChallengeProofImage: proofUrl,
        vehiclePresencePhotoUrl: proofUrl,
        vehiclePresenceS3Key: upload.key,
        photoChallengeVerified: true,
        livePhotoVerified: true,
        challengeCodeVerified: true,
        photoChallengeCompletedAt: new Date().toISOString(),
      });
      setVehicle(updated);
      toast.success('Photo challenge completed.');
    } catch (error: any) {
      toast.error(error.message || 'Unable to complete the photo challenge.');
    } finally {
      setChallengeSubmitting(false);
    }
  };
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

  const handleReportListing = async () => {
    if (!user) {
      login();
      return;
    }
    setReportOpen(true);
  };

  const handleSubmitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !vehicle) return;
    const description = reportText.trim();
    if (!description) return;
    setReportSubmitting(true);
    try {
      await createReport({
        reportedUserId: vehicle.userId || (vehicle as any).seller?.id || '',
        listingId: vehicle.id,
        category: 'fake_listing',
        description,
      });
      toast.success('Report submitted for Kerodex review.');
      setReportOpen(false);
      setReportText('');
    } catch (error: any) {
      toast.error(error.message || 'Unable to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in px-4 lg:px-8 py-10 max-w-screen-2xl mx-auto pb-24 md:pb-10">
      {reportOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md border border-border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[14px] font-black tracking-tight">Report listing</h2>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Tell Kerodex what should be reviewed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Close report dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="text-[12px] text-muted-foreground">
                Reporting <span className="text-foreground font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</span>.
              </div>
              <textarea
                value={reportText}
                onChange={(event) => setReportText(event.target.value)}
                rows={5}
                autoFocus
                placeholder="Describe the issue with this listing..."
                className="w-full resize-none border border-border bg-background px-3 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportOpen(false)}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!reportText.trim() || reportSubmitting}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
              >
                Submit Report
              </Button>
            </div>
          </form>
        </div>
      )}
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
              {activeTab === 'features' && <FeaturesTab vehicle={vehicle} />}
              {activeTab === 'history' && <HistoryTab vehicle={vehicle} />}
              {activeTab === 'timeline' && <TimelineTab vehicle={vehicle} />}
            </div>
          </div>

          <SellerCard vehicle={vehicle} />
          <RiskMeter vehicle={vehicle} />
          <ScamWarnings vehicle={vehicle} />
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
                  VIN: {displayVin(vehicle)}
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

              <MarketValuePanel vehicle={vehicle} />
              <TrustSection vehicle={vehicle} />

              {/* CTAs */}
              <div className="space-y-3">
                <Button className="w-full h-12 text-[12px] font-bold uppercase tracking-widest"
                  onClick={handleMessageSeller}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline"
                    className={`h-10 text-[11px] font-bold uppercase tracking-widest ${isSaved ? 'border-primary text-primary' : ''}`}
                    onClick={() => toggleSaved()}>
                    <Heart className={`h-4 w-4 mr-1.5 ${isSaved ? 'fill-current' : ''}`} />
                    {isSaved ? 'Saved' : 'Save'}
                  </Button>
                  <Button variant="outline" className="h-10 text-[11px] font-bold uppercase tracking-widest"
                    onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}>
                    <Share2 className="h-4 w-4 mr-1.5" /> Share
                  </Button>
                </div>
                <Button variant="outline" className="w-full h-10 text-[11px] font-bold uppercase tracking-widest"
                  onClick={handleReportListing}>
                  <Flag className="h-4 w-4 mr-1.5" /> Report Listing
                </Button>
                <button className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 text-center pt-1"
                  onClick={() => toast.success('Message sent to seller!')}>
                  Is this still available?
                </button>
              </div>
            </div>

            <PhotoChallengeBadge
              vehicle={vehicle}
              currentUserId={user?.id}
              onComplete={handlePhotoChallengeUpload}
              completing={challengeSubmitting}
            />
            <ListingCompleteness vehicle={vehicle} />
            <PaymentEstimator price={vehicle.price} />
            <TradeIn />

            {/* Security note */}
            <div className="flex gap-3 p-4 border border-border bg-muted/20">
              <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {trustScore(vehicle) >= 75
                  ? 'Kerodex found stronger verification signals for this listing. Continue to review documents before meeting or paying.'
                  : 'Review verification signals, seller disclosures, and documents before meeting or paying.'}
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
          onClick={() => toggleSaved(true)}>
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
