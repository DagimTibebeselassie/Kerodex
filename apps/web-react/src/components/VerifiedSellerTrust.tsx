import { BadgeCheck } from 'lucide-react';

export const VERIFIED_SELLER_EXPLANATION =
  "Verified Seller means the seller completed Kerodex's identity verification process through Persona. It does not guarantee the vehicle, listing, seller behavior, transaction outcome, or listing accuracy.";

export function VerifiedSellerBadge({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      title={VERIFIED_SELLER_EXPLANATION}
      aria-label={`Verified Seller. ${VERIFIED_SELLER_EXPLANATION}`}
      className={`inline-flex items-center gap-1.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${compact ? 'px-2 py-0.5' : 'px-2 py-1'} ${className}`}
    >
      <BadgeCheck className="h-3 w-3 shrink-0" />
      Verified Seller
    </span>
  );
}
