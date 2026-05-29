import { useEffect, useRef, useState } from 'react';
import { Vehicle } from '@/types';

interface MapViewProps {
  vehicles?: Vehicle[];
  selectedId?: string | null;
  onSelectPin?: (id: string) => void;
  className?: string;
  isDark?: boolean;
}

function fallbackGeo(id: string, baseLatLng: [number, number]): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const lat = baseLatLng[0] + ((hash % 100) / 1000);
  const lng = baseLatLng[1] + (((hash >> 3) % 100) / 1000);
  return [lat, lng];
}

export function MapView({ vehicles = [], selectedId, onSelectPin, className = '', isDark = false }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      // Fix default icon path issue with Vite
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [37.0902, -95.7129], // USA center
        zoom: 5,
        zoomControl: false,
        attributionControl: false,
      });

      // Custom zoom control position
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // CARTO tile style — light or dark
      tileLayerRef.current = L.tileLayer(tileUrl, {
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 4,
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsReady(true);
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersRef.current = [];
        setIsReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!tileLayerRef.current) return;
    tileLayerRef.current.setUrl(tileUrl);
  }, [tileUrl]);

  // Add/update markers when vehicles change
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds: [number, number][] = [];

      vehicles.forEach((v) => {
        const [lat, lng] = Number.isFinite(v.lat) && Number.isFinite(v.lng)
          ? [Number(v.lat), Number(v.lng)]
          : fallbackGeo(v.id, [37.0902, -95.7129]);
        const isSelected = v.id === selectedId;
        bounds.push([lat, lng]);

        const html = `
          <div data-marker-id="${v.id}" style="
            background:${isSelected ? '#000' : '#fff'};
            color:${isSelected ? '#fff' : '#000'};
            border:1.5px solid ${isSelected ? '#000' : '#d1d5db'};
            padding:4px 8px;
            font-size:11px;
            font-weight:700;
            font-family:Inter,sans-serif;
            white-space:nowrap;
            cursor:pointer;
            box-shadow:0 1px 4px rgba(0,0,0,0.15);
            transition:all .15s;
          ">$${v.price.toLocaleString()}</div>
        `;

        const icon = L.divIcon({
          html,
          className: '',
          iconAnchor: [0, 0],
        });

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapInstanceRef.current)
          .on('click', () => onSelectPin?.(v.id));

        markersRef.current.push(marker);
      });

      if (bounds.length > 1) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
      } else if (bounds.length === 1) {
        mapInstanceRef.current.setView(bounds[0], 10);
      }
      window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 0);
    });
  }, [vehicles, selectedId, onSelectPin, isReady]);

  return (
    <div
      id="map-view"
      ref={mapRef}
      className={`w-full h-full ${className}`}
      aria-label="Vehicle listings map"
      role="region"
    />
  );
}
