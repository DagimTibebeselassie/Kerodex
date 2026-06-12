import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui';
import { ArrowLeft, BadgeCheck, Calendar, CheckCircle2, Clock, MapPin, MessageSquare, Shield } from 'lucide-react';
import { getSellerProfile, SellerProfileRecord } from '@/lib/api';
import { Vehicle } from '@/types';
import { VehicleCard } from '@/components/VehicleCard';

type SellerWithListings = Omit<SellerProfileRecord, 'listings'> & { listings: Vehicle[] };

function VerificationRow({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/60 last:border-b-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-border" />}
        {done ? 'Complete' : 'Pending'}
      </span>
    </div>
  );
}

export function SellerProfilePage() {
  const { id } = useParams({ from: '/seller/$id' });
  const [seller, setSeller] = useState<SellerWithListings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getSellerProfile(id)
      .then((data) => {
        if (alive) setSeller(data as SellerWithListings);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Seller not found.');
      });
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link to="/search" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>
        <h1 className="text-2xl font-black tracking-tight mb-2">Seller profile unavailable</h1>
        <p className="text-[14px] text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!seller) {
    return <div className="p-12 animate-pulse text-[13px] text-muted-foreground">Loading seller profile...</div>;
  }

  const verification = seller.verification || {};
  const location = [seller.city, seller.state].filter(Boolean).join(', ');
  const memberSince = seller.memberSince
    ? new Date(seller.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  return (
    <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-10 space-y-10">
      <Link to="/search" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-8">
          <div className="flex items-start gap-5">
            <div className="h-20 w-20 rounded-full bg-foreground text-background flex items-center justify-center text-xl font-black shrink-0">
              {seller.initials || seller.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{seller.name}</h1>
                {verification.identity && verification.phone && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border border-border px-2 py-1">
                    <BadgeCheck className="h-3.5 w-3.5" /> Identity checked
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
                {location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {location}</span>}
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Member since {memberSince}</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {seller.responseTime}</span>
              </div>
              <p className="text-[15px] text-muted-foreground leading-relaxed mt-5 max-w-2xl">{seller.bio}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Active listings', String(seller.listings?.length || 0)],
              ['Completed sales', String(seller.completedSales || 0)],
              ['Response rate', seller.responseRate ? `${seller.responseRate}%` : 'New'],
              ['Reviews', seller.reviewCount ? `${seller.rating?.toFixed(1)} (${seller.reviewCount})` : 'None yet'],
            ].map(([label, value]) => (
              <div key={label} className="border border-border p-4">
                <div className="text-2xl font-black">{value}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] mb-5">Listings by {seller.name.split(' ')[0]}</h2>
            {seller.listings?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {seller.listings.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
              </div>
            ) : (
              <div className="border border-border p-8 text-[13px] text-muted-foreground">No active listings from this seller.</div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-border p-5">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Verification
            </h2>
            <VerificationRow label="Email" done={verification.email} />
            <VerificationRow label="Phone" done={verification.phone} />
            <VerificationRow label="Government ID" done={verification.identity} />
            <VerificationRow label="Selfie check" done={verification.selfie} />
          </div>

          <div className="border border-border p-5 space-y-4">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em]">Contact Rules</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Kerodex keeps seller contact inside messages until both sides are ready. Documents are reviewed privately and are not shown publicly.
            </p>
            <Link to="/search">
              <Button variant="outline" className="w-full h-10 text-[11px] font-bold uppercase tracking-widest">
                <MessageSquare className="h-3.5 w-3.5 mr-2" /> View listings
              </Button>
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
