import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, X, MapPin, Gauge, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVehicles } from '@/hooks/useSavedVehicles';
import { toast } from 'sonner';
import { VerifiedSellerBadge } from './VerifiedSellerTrust';
import { vehicleImageAlt } from '@/lib/vehicleImage';

interface MapViewProps {
  vehicles?: Vehicle[];
  selectedId?: string | null;
  onSelectPin?: (id: string | null) => void;
  className?: string;
  isDark?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  locationFocusRequest?: number;
}

function pseudoGeo(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  }
  const lat = 25 + (Math.abs(h % 1000) / 1000) * 22;
  const lng = -124 + (Math.abs((h >> 4) % 1000) / 1000) * 58;
  return [lat, lng];
}

function vehicleCoords(vehicle: Vehicle): [number, number] {
  const lat = Number(vehicle.lat);
  const lng = Number(vehicle.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return pseudoGeo(vehicle.id);
}

function getImageUrl(vehicle: Vehicle): string {
  try {
    const p = typeof vehicle.images === 'string' ? JSON.parse(vehicle.images as unknown as string) : vehicle.images;
    return Array.isArray(p) ? p[0] : p;
  } catch { return ''; }
}

function fmt(n: number) { return n.toLocaleString(); }

function tileUrlForTheme(isDark: boolean) {
  return isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

const MAP_BOUNDS: [[number, number], [number, number]] = [[18, -170], [72, -50]];

function tileOptions() {
  return {
    subdomains: 'abcd',
    maxZoom: 19,
    minZoom: 3,
    attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a> / <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
  };
}

function PopupCard({
  vehicle,
  onClose,
  saved,
  onSave,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  const img = getImageUrl(vehicle);

  return (
    <div
      className={[
        'kerodex-map-card absolute z-[1200] flex flex-col overflow-hidden',
        'border border-border bg-background text-foreground shadow-2xl',
        'bottom-2 left-2 right-2 max-h-[calc(100%-1rem)] w-auto',
        'md:bottom-auto md:top-3 md:right-3 md:left-auto md:w-72 md:max-h-none',
      ].join(' ')}
      style={{ maxWidth: '100%' }}
    >
      {/* Image */}
      <div className="relative h-20 w-full shrink-0 sm:h-28 md:h-40">
        {img ? (
          <img
            src={img}
            alt={vehicleImageAlt(vehicle)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm bg-muted text-muted-foreground">
            No photo
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center border border-border bg-background/90 text-foreground backdrop-blur transition-colors hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Save / Heart */}
        <button
          onClick={onSave}
          className={[
            'absolute top-2 left-2 flex h-9 w-9 items-center justify-center border border-border bg-background/90 text-foreground backdrop-blur transition-colors hover:bg-muted',
            saved ? 'text-foreground' : '',
          ].join(' ')}
          aria-label={saved ? 'Unsave listing' : 'Save listing'}
        >
          <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1 md:space-y-3 md:overflow-visible md:pr-0">
          {/* Price */}
          <p className="text-lg font-black tracking-tight leading-none sm:text-xl">
            ${fmt(vehicle.price)}
          </p>

          {/* Year Make Model */}
          <p className="text-[13px] font-bold leading-tight">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>

          {/* Mileage + Location */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3 shrink-0" />
              {fmt(vehicle.mileage)} mi
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{vehicle.location}</span>
            </span>
          </div>

          {/* Badges */}
          <div className="hidden items-center gap-1.5 flex-wrap sm:flex">
            {vehicle.isDemo && (
              <span className="inline-flex items-center gap-1 border border-foreground px-2 py-1 text-[10px] font-black uppercase tracking-wider">
                Demo Listing
              </span>
            )}
            {vehicle.seller?.verified && <VerifiedSellerBadge />}
            <span className={[
              'inline-flex items-center gap-1 border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground',
            ].join(' ')}>
              <CheckCircle2 className="h-3 w-3" /> Clean Title
            </span>
          </div>
        </div>

        {/* CTA */}
        <Link
          to="/vehicle/$id"
          params={{ id: vehicle.id }}
          className={[
            'mt-2 block w-full shrink-0 border border-foreground bg-foreground px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-background transition-opacity hover:opacity-90 sm:text-[11px]',
          ].join(' ')}
        >
          View Listing
        </Link>
      </div>
    </div>
  );
}

export function MapView({
  vehicles = [],
  selectedId,
  onSelectPin,
  className = '',
  isDark = false,
  userLocation = null,
  locationFocusRequest = 0,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const { user, login } = useAuth();
  const savedVehicles = useSavedVehicles(user?.id);
  const savedIds = savedVehicles.savedIds;
  const [mapReady, setMapReady] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);

  // Sync active vehicle with selectedId prop
  useEffect(() => {
    if (!selectedId) { setActiveVehicle(null); return; }
    const v = vehicles.find((v) => v.id === selectedId) ?? null;
    setActiveVehicle(v);
  }, [selectedId, vehicles]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (!containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        center: [37.5, -96],
        zoom: 4,
        zoomControl: false,
        attributionControl: false,
        maxBounds: MAP_BOUNDS,
        maxBoundsViscosity: 0.9,
        worldCopyJump: false,
        inertia: false,
      });
      map.setMaxBounds(MAP_BOUNDS);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

      const tileUrl = tileUrlForTheme(isDark);
      const tile = L.tileLayer(tileUrl, tileOptions());
      tile.on('tileerror', () => {
        setTileFailed(false);
      });
      tile.on('tileload', () => setTileFailed(false));
      tile.addTo(map);

      mapRef.current = map;
      tileLayerRef.current = tile;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 0);
      setTimeout(() => map.invalidateSize(), 250);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
        markersRef.current = [];
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    import('leaflet').then((L) => {
      tileLayerRef.current.remove();
      const tileUrl = tileUrlForTheme(isDark);
      const tile = L.tileLayer(tileUrl, tileOptions());
      tile.on('tileerror', () => {
        setTileFailed(false);
      });
      tile.on('tileload', () => setTileFailed(false));
      tile.addTo(mapRef.current);
      tileLayerRef.current = tile;
      mapRef.current.setMaxBounds(MAP_BOUNDS);
      setTimeout(() => mapRef.current?.invalidateSize(), 0);
    });
  }, [isDark]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const refresh = () => map.invalidateSize();
    refresh();
    const shortTimer = window.setTimeout(refresh, 150);
    const longTimer = window.setTimeout(refresh, 450);
    return () => {
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
    };
  }, [className, mapReady, vehicles.length]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const refresh = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (vehicles.length === 0) return;

      const bounds: [number, number][] = [];

      vehicles.forEach((v) => {
        const [lat, lng] = vehicleCoords(v);
        bounds.push([lat, lng]);
        const isSelected = v.id === selectedId;

        const bg  = isSelected ? '#111827'              : (isDark ? '#1c2333' : '#ffffff');
        const fg  = isSelected ? '#ffffff'              : (isDark ? '#e5e7eb' : '#111827');
        const bdr = isSelected ? '#111827'              : (isDark ? '#374151' : '#d1d5db');
        const shadow = isSelected ? '0 2px 8px rgba(0,0,0,.45)' : '0 1px 4px rgba(0,0,0,.18)';
        const scale = isSelected ? 'scale(1.12)' : 'scale(1)';

        const html = `<div style="
          position:relative;display:inline-flex;align-items:center;justify-content:center;
          background:${bg};color:${fg};border:1.5px solid ${bdr};
          min-width:48px;padding:5px 10px;box-sizing:border-box;
          font-size:12px;font-weight:800;line-height:1;
          font-family:Inter,sans-serif;white-space:nowrap;cursor:pointer;
          border-radius:999px;box-shadow:${shadow};transform:${scale};
          transition:transform .12s,box-shadow .12s;
        ">
          $${v.price.toLocaleString()}
          <span style="
            position:absolute;left:50%;bottom:-5px;width:9px;height:9px;
            background:${bg};border-right:1.5px solid ${bdr};border-bottom:1.5px solid ${bdr};
            transform:translateX(-50%) rotate(45deg);
          "></span>
        </div>`;

        const icon = L.divIcon({ html, className: 'kerodex-price-pin', iconSize: [76, 34], iconAnchor: [38, 34] });

        const marker = L.marker([lat, lng], { icon }).addTo(map).on('click', () => {
          setActiveVehicle(v);
          onSelectPin?.(v.id);
        });

        markersRef.current.push(marker);
      });

      if (bounds.length > 0 && !selectedId) {
        try {
          map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 10 });
        } catch { /* ignore */ }
      }
    });
  }, [vehicles, selectedId, isDark, onSelectPin, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userLocation) return;
    map.invalidateSize();
    map.setView([userLocation.lat, userLocation.lng], 11, { animate: false });
  }, [userLocation, locationFocusRequest, mapReady]);

  const handleClose = () => {
    setActiveVehicle(null);
    onSelectPin?.(null);
  };

  const handleSave = async (id: string) => {
    if (!user) {
      login();
      toast.error('Sign in to save vehicles.');
      return;
    }
    const saved = !savedIds.has(id);
    try {
      await savedVehicles.setSaved(id, saved);
    } catch (error: any) {
      toast.error(error?.message || 'Unable to update saved vehicles.');
    }
  };

  return (
    <div
      ref={containerRef}
      className={`kerodex-map-root w-full h-full relative z-0 isolate overflow-hidden ${className}`}
      aria-label="Vehicle listings map"
      role="region"
      style={{
        backgroundColor: isDark ? '#101317' : '#eef1ed',
        backgroundImage: isDark
          ? 'linear-gradient(30deg, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(120deg, rgba(255,255,255,.035) 1px, transparent 1px)'
          : 'linear-gradient(30deg, rgba(17,24,39,.08) 1px, transparent 1px), linear-gradient(120deg, rgba(17,24,39,.06) 1px, transparent 1px)',
        backgroundSize: '120px 120px, 180px 180px',
      }}
    >
      {tileFailed && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-80"
          aria-hidden="true"
          style={{
            backgroundColor: isDark ? '#101317' : '#eef1ed',
            backgroundImage: isDark
              ? 'linear-gradient(24deg, transparent 46%, rgba(255,255,255,.08) 47%, rgba(255,255,255,.08) 49%, transparent 50%), linear-gradient(112deg, transparent 48%, rgba(255,255,255,.06) 49%, rgba(255,255,255,.06) 51%, transparent 52%)'
              : 'linear-gradient(24deg, transparent 46%, rgba(31,41,55,.14) 47%, rgba(31,41,55,.14) 49%, transparent 50%), linear-gradient(112deg, transparent 48%, rgba(31,41,55,.10) 49%, rgba(31,41,55,.10) 51%, transparent 52%)',
            backgroundSize: '150px 150px, 210px 210px',
          }}
        />
      )}
      {activeVehicle && (
        <PopupCard
          vehicle={activeVehicle}
          onClose={handleClose}
          saved={savedIds.has(activeVehicle.id)}
          onSave={() => handleSave(activeVehicle.id)}
        />
      )}
    </div>
  );
}
