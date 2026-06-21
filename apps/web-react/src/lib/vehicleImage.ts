import type { Vehicle } from '@/types';

export const LOCAL_VEHICLE_FALLBACK = '/assets/sedan1.webp';

export function vehicleImageAlt(vehicle: Partial<Vehicle>, suffix = '') {
  const base = (vehicle.isDemo || vehicle.is_demo) && vehicle.imageAlt
    ? vehicle.imageAlt
    : [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  return suffix ? `${base} ${suffix}` : base;
}
