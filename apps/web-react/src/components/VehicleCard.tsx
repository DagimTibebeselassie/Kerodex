import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Vehicle } from '@/types';
import { savedVehicleIds, saveVehicleLocal } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Heart, MapPin, Gauge, BadgeCheck, Star } from 'lucide-react';
import { toast } from '@blinkdotnew/ui';
import { VERIFIED_SELLER_EXPLANATION, VerifiedSellerBadge } from './VerifiedSellerTrust';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSave?: (id: string, saved: boolean) => void;
  savedIds?: Set<string>;
  dealScore?: 'great' | 'good' | 'fair' | null;
  isVerified?: boolean;
  className?: string;
}

export function VehicleCard({
  vehicle,
  onSave,
  savedIds,
  dealScore = null,
  isVerified = false,
  className = '',
}: VehicleCardProps) {
  const { user, login } = useAuth();
  const [saved, setSaved] = useState(savedIds?.has(vehicle.id) ?? savedVehicleIds().has(vehicle.id));
  const verified = isVerified || Boolean(vehicle.seller?.verified);
  const visibleBadges = (vehicle.badges || []).slice(0, 2);

  const imageUrl = (() => {
    try {
      const parsed = typeof vehicle.images === 'string' ? JSON.parse(vehicle.images) : vehicle.images;
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return vehicle.images as unknown as string;
    }
  })() || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800';

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      login();
      toast.error('Sign in to save vehicles.');
      return;
    }
    const next = !saved;
    setSaved(next);
    saveVehicleLocal(vehicle.id, next);
    onSave?.(vehicle.id, next);
  };

  const dealColors: Record<string, string> = {
    great: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
    good: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900',
    fair: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  };

  return (
    <Link
      to="/vehicle/$id"
      params={{ id: vehicle.id }}
      className={`group flex h-full flex-col bg-background border border-border hover:border-foreground/20 transition-colors ${className}`}
      data-vehicle-id={vehicle.id}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />

        {/* Save Button */}
        <button
          id={`save-btn-${vehicle.id}`}
          data-action="save-vehicle"
          data-vehicle-id={vehicle.id}
          onClick={handleSave}
          aria-label={saved ? 'Unsave vehicle' : 'Save vehicle'}
          aria-pressed={saved}
          className={`absolute top-3 right-3 h-8 w-8 flex items-center justify-center border transition-all ${
            saved
              ? 'bg-foreground text-background border-foreground'
              : 'bg-background/90 text-muted-foreground border-border hover:border-foreground hover:text-foreground'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`} />
        </button>

        {/* Deal Score Badge */}
        {dealScore && (
          <div className={`absolute top-3 left-3 px-2 py-1 text-[10px] font-bold uppercase tracking-wider border ${dealColors[dealScore]}`}>
            {dealScore === 'great' ? '* Great Deal' : dealScore === 'good' ? 'Good Deal' : 'Fair Price'}
          </div>
        )}

        {/* Price Tag */}
        <div className="absolute bottom-3 left-3 bg-background/95 backdrop-blur-sm px-3 py-1.5 border border-border">
          <span className="text-[13px] font-bold">${vehicle.price.toLocaleString()}</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex min-h-10 items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[14px] font-bold tracking-tight leading-tight">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          {verified && (
            <BadgeCheck
              className="h-4 w-4 text-foreground shrink-0 mt-0.5"
              title={VERIFIED_SELLER_EXPLANATION}
              aria-label={`Verified Seller. ${VERIFIED_SELLER_EXPLANATION}`}
            />
          )}
        </div>

        <div className="mt-2 flex min-h-8 items-center gap-3 text-[12px] text-muted-foreground">
          <span className="flex shrink-0 items-center gap-1">
            <Gauge className="h-3 w-3" />
            {vehicle.mileage.toLocaleString()} mi
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{vehicle.location}</span>
          </span>
        </div>

        {/* Badges row */}
        <div className="mt-auto flex min-h-[3.35rem] content-start flex-wrap gap-1.5 overflow-hidden pt-3">
          {verified && (
            <VerifiedSellerBadge compact />
          )}
          {visibleBadges.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-border text-muted-foreground">
              {badge}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
