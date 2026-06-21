import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { Button } from '@blinkdotnew/ui';
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, MessageSquare, Shield, Star, X } from 'lucide-react';
import { VerifiedSellerBadge } from '@/components/VerifiedSellerTrust';
import { getSellerProfile, leaveSellerReview, SellerProfileRecord } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Vehicle } from '@/types';
import { VehicleCard } from '@/components/VehicleCard';
import { defaultProfileIconForUser } from '@/lib/profile-icons';

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
  const { user, login } = useAuth();
  const [seller, setSeller] = useState<SellerWithListings | null>(null);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

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
  const reviews = Array.isArray(seller.reviews) ? seller.reviews : [];
  const reviewCount = reviews.length;
  const sellerReviewRating = reviewCount
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount
    : null;
  const fallbackAvatar = defaultProfileIconForUser({ id: seller.id, email: '', username: '' });
  const avatarUrl = avatarFailed ? fallbackAvatar : (seller.avatarUrl || fallbackAvatar);

  const openReview = () => {
    if (!user) {
      login();
      return;
    }
    setReviewError('');
    setReviewOpen(true);
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    setReviewError('');
    setReviewSaving(true);
    try {
      const result = await leaveSellerReview(seller.id, reviewRating, reviewComment);
      setSeller(result.seller as SellerWithListings);
      setReviewComment('');
      setReviewRating(5);
      setReviewOpen(false);
    } catch (err: any) {
      setReviewError(err.message || 'Unable to save review.');
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 lg:px-8 py-10 space-y-10">
      <Link to="/search" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-8">
          {(seller.isDemo || seller.is_demo) && (
            <div className="border border-amber-300 bg-amber-50/70 p-4 text-[12px] leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <strong>Demo Seller Profile:</strong> this sample profile is provided to demonstrate Kerodex features. Its listings, contact activity, and reviews are not real marketplace activity.
            </div>
          )}
          <div className="flex items-start gap-5">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-foreground text-background flex items-center justify-center text-xl font-black shrink-0">
              <img
                src={avatarUrl}
                alt={`${seller.name} profile`}
                className="h-full w-full object-cover"
                onError={() => {
                  if (avatarUrl !== fallbackAvatar) setAvatarFailed(true);
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{seller.name}</h1>
                {verification.identity && verification.phone && (
                  <VerifiedSellerBadge />
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
              ['Reviews', reviewCount && sellerReviewRating ? `${sellerReviewRating.toFixed(1)} (${reviewCount})` : 'None yet'],
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

          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-[0.18em] mb-5">Seller reviews</h2>
            {reviews.length ? (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <article key={review.id} className="border border-border p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold">{review.reviewerName}</p>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Star className="h-3 w-3 fill-current" /> {Number(review.rating).toFixed(1)}
                          </span>
                        </div>
                        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{review.comment}</p>
                      </div>
                      <time className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border border-border p-8 text-[13px] text-muted-foreground">No seller reviews yet.</div>
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

          <Button onClick={openReview} disabled={Boolean(seller.isDemo || seller.is_demo)} className="w-full h-10 text-[11px] font-bold uppercase tracking-widest">
            <Star className="h-3.5 w-3.5 mr-2" /> {(seller.isDemo || seller.is_demo) ? 'Demo Reviews Disabled' : 'Leave a review'}
          </Button>
        </aside>
      </section>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <form onSubmit={submitReview} className="w-full max-w-md border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Seller review</p>
                <h2 className="mt-2 text-xl font-black tracking-tight">Review {seller.name}</h2>
              </div>
              <button type="button" onClick={() => setReviewOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6">
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewRating(rating)}
                    className={`h-10 w-10 border border-border flex items-center justify-center transition-colors ${
                      rating <= reviewRating ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="seller-review-comment" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Review</label>
              <textarea
                id="seller-review-comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Share what it was like messaging or working with this seller."
                className="min-h-28 w-full resize-none border border-border bg-background px-3 py-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              />
            </div>

            {reviewError && <p className="mt-3 text-[12px] text-destructive">{reviewError}</p>}

            <div className="mt-6 flex gap-3">
              <Button type="submit" disabled={reviewSaving} className="h-10 flex-1 text-[11px] font-bold uppercase tracking-widest">
                {reviewSaving ? 'Saving...' : 'Submit review'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setReviewOpen(false)} className="h-10 px-5 text-[11px] font-bold uppercase tracking-widest">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
