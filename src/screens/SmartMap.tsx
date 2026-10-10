import { useEffect, useState, useRef, useMemo } from 'react';
import {
  MapPin, Phone, Clock, Navigation, Hospital, Shield, Flame, SquareParking,
  Building2, Pill, TreePine, Bus, X, Compass, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Modal } from '@/components/Modal';
import type { MapPoint, MapCategory } from '@/lib/types';

const categoryConfig: Record<MapCategory, { icon: typeof Hospital; color: string; bg: string; label: string }> = {
  hospital: { icon: Hospital, color: 'text-error-500', bg: 'bg-error-500', label: 'Hospitals' },
  police: { icon: Shield, color: 'text-secondary-600', bg: 'bg-secondary-600', label: 'Police' },
  fire: { icon: Flame, color: 'text-accent-500', bg: 'bg-accent-500', label: 'Fire' },
  parking: { icon: SquareParking, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-700', label: 'Parking' },
  government: { icon: Building2, color: 'text-primary-600', bg: 'bg-primary-600', label: 'Government' },
  pharmacy: { icon: Pill, color: 'text-primary-500', bg: 'bg-primary-500', label: 'Pharmacy' },
  park: { icon: TreePine, color: 'text-emerald-500', bg: 'bg-emerald-600', label: 'Parks' },
  transit: { icon: Bus, color: 'text-secondary-500', bg: 'bg-secondary-500', label: 'Transit' },
};

const categorySvgs: Record<MapCategory, string> = {
  hospital: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h-2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/><rect width="12" height="14" x="6" y="2" rx="2"/></svg>`,
  police: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2a1 1 0 0 1 .76.97Z"/></svg>`,
  fire: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  parking: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>`,
  government: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 18H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/><path d="M18 18h2a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`,
  pharmacy: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  park: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18H7a2 2 0 0 1-2-2c0-3.87 3.13-7 7-7s7 3.13 7 7a2 2 0 0 1-2 2z"/><path d="M12 9v13"/></svg>`,
  transit: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M4 18v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3"/><path d="M17 18v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3"/><path d="M4 11h16"/><path d="M2 15h20"/><path d="M4 6h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/></svg>`
};

// Real geographical locations for Bhubaneswar
const realBhubaneswarPoints = [
  // Hospitals
  { id: 'bh-hosp-1', name: 'All India Institute of Medical Sciences (AIIMS)', category: 'hospital' as const, lat: 20.2223, lng: 85.7335, address: 'Sijua, Patrapada, Bhubaneswar, Odisha 751019', phone: '0674-247-6600', open_24h: true },
  { id: 'bh-hosp-2', name: 'AMRI Hospital Bhubaneswar', category: 'hospital' as const, lat: 20.2742, lng: 85.7950, address: 'Khandagiri, Bhubaneswar, Odisha 751030', phone: '0674-666-6600', open_24h: true },
  { id: 'bh-hosp-3', name: 'KIMS Hospital', category: 'hospital' as const, lat: 20.3533, lng: 85.8189, address: 'KIIT Campus 5, Patia, Bhubaneswar, Odisha 751024', phone: '0674-272-5228', open_24h: true },
  
  // Police
  { id: 'bh-pol-1', name: 'Tamando Police Station', category: 'police' as const, lat: 20.2185, lng: 85.7275, address: 'NH 16, Tamando, Bhubaneswar, Odisha 751028', phone: '100', open_24h: true },
  { id: 'bh-pol-2', name: 'Khandagiri Police Station', category: 'police' as const, lat: 20.2599, lng: 85.7876, address: 'Khandagiri, Bhubaneswar, Odisha 751030', phone: '100', open_24h: true },
  { id: 'bh-pol-3', name: 'Jatni Police Station', category: 'police' as const, lat: 20.1633, lng: 85.7042, address: 'Jatni, Odisha 752050', phone: '100', open_24h: true },

  // Fire
  { id: 'bh-fire-1', name: 'Khandagiri Fire Station', category: 'fire' as const, lat: 20.2612, lng: 85.7885, address: 'Khandagiri, Bhubaneswar, Odisha 751030', phone: '101', open_24h: true },
  { id: 'bh-fire-2', name: 'Bhubaneswar Fire Station HQ', category: 'fire' as const, lat: 20.2882, lng: 85.8402, address: 'Buxi Jagabandhu Nagar, Bhubaneswar, Odisha 751014', phone: '101', open_24h: true },

  // Transit
  { id: 'bh-trans-1', name: 'Gohiria Mo Bus Stop', category: 'transit' as const, lat: 20.2263, lng: 85.7483, address: 'Janla, Odisha 752054', phone: '', open_24h: true },
  { id: 'bh-trans-2', name: 'Bhubaneswar Railway Station', category: 'transit' as const, lat: 20.2644, lng: 85.8404, address: 'Master Canteen Square, Bhubaneswar, Odisha 751009', phone: '139', open_24h: true },

  // Parks
  { id: 'bh-park-1', name: 'Biju Patnaik Park', category: 'park' as const, lat: 20.2520, lng: 85.8340, address: 'Forest Park, Bhubaneswar, Odisha 751009', phone: '', open_24h: false },
  { id: 'bh-park-2', name: 'Ekamra Kanan Botanical Gardens', category: 'park' as const, lat: 20.3015, lng: 85.8118, address: 'Nayapalli, Bhubaneswar, Odisha 751015', phone: '', open_24h: false },

  // Pharmacy
  { id: 'bh-pharm-1', name: 'Apollo Pharmacy 24x7', category: 'pharmacy' as const, lat: 20.2190, lng: 85.7340, address: 'Janla Market, Bhubaneswar, Odisha 752054', phone: '0674-245-1200', open_24h: true },
  { id: 'bh-pharm-2', name: 'Wellness Forever Pharmacy', category: 'pharmacy' as const, lat: 20.2605, lng: 85.7890, address: 'Khandagiri Chowk, Bhubaneswar, Odisha 751030', phone: '0674-245-1300', open_24h: true },

  // Parking
  { id: 'bh-parkg-1', name: 'Master Canteen Public Parking', category: 'parking' as const, lat: 20.2650, lng: 85.8395, address: 'Station Rd, Master Canteen, Bhubaneswar, Odisha 751009', phone: '', open_24h: true }
];

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface MapProps {
  onBack: () => void;
  initialCategory?: MapCategory;
}

export function SmartMap({ onBack, initialCategory }: MapProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [activeCats, setActiveCats] = useState<Set<MapCategory>>(
    new Set(initialCategory ? [initialCategory] : ['hospital'])
  );
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(10);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCategory) {
      setActiveCats(new Set([initialCategory]));
    }
  }, [initialCategory]);

  const mapRef = useRef<any>(null);
  const layersRef = useRef<any>(null);
  const leafletMapContainerRef = useRef<HTMLDivElement | null>(null);
  const isFirstLoad = useRef(true);

  const loadPoints = async (lat?: number, lng?: number) => {
    try {
      const { data } = await supabase.from('map_points').select('*');
      let allPoints = data ?? [];

      if (lat !== undefined && lng !== undefined) {
        const isBhubaneswar = Math.abs(lat - 20.2184) < 1.0 && Math.abs(lng - 85.7331) < 1.0;
        if (isBhubaneswar) {
          const filteredReal = realBhubaneswarPoints.filter(
            realP => !allPoints.some((dbP: any) => dbP.name === realP.name)
          );
          allPoints = [...allPoints, ...filteredReal];
        } else {
          const nearby = allPoints.filter((p: any) => 
            Math.abs(Number(p.lat) - lat) < 0.25 && 
            Math.abs(Number(p.lng) - lng) < 0.25
          );
          if (nearby.length === 0) {
            const localPoints = [
              { id: 'hosp-1', name: 'City Hospital Emergency', category: 'hospital' as const, lat: lat + 0.004, lng: lng - 0.005, address: 'Near Main Highway', phone: '080-2234-4500', open_24h: true },
              { id: 'pol-1', name: 'Sector Police HQ', category: 'police' as const, lat: lat - 0.006, lng: lng + 0.007, address: 'Main Chowk Road', phone: '100', open_24h: true },
              { id: 'fire-1', name: 'Local Fire Station', category: 'fire' as const, lat: lat + 0.010, lng: lng - 0.002, address: 'Central Ward Crossing', phone: '101', open_24h: true },
              { id: 'trans-1', name: 'Metro Transit Hub', category: 'transit' as const, lat: lat - 0.002, lng: lng - 0.003, address: 'Gate No 2, Station Road', phone: '1077', open_24h: true },
              { id: 'park-1', name: 'Central Parking Space', category: 'parking' as const, lat: lat + 0.006, lng: lng + 0.003, address: 'Multi-level Complex', phone: '', open_24h: true },
              { id: 'pharm-1', name: 'Apex Pharmacy 24x7', category: 'pharmacy' as const, lat: lat - 0.004, lng: lng + 0.005, address: 'Market Block-A', phone: '080-4560-2211', open_24h: true },
              { id: 'prk-1', name: 'Municipal Park & Garden', category: 'park' as const, lat: lat + 0.002, lng: lng + 0.006, address: 'Green Avenue', phone: '', open_24h: false }
            ];
            allPoints = [...allPoints, ...localPoints];
          }
        }
      }
      setPoints(allPoints);
    } catch (e) {
      console.warn("Error loading map points:", e);
      setPoints(realBhubaneswarPoints);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLoc({ lat, lng });
          setGeoError(null);
          loadPoints(lat, lng);
          
          if (isFirstLoad.current && mapRef.current) {
            mapRef.current.setView([lat, lng], 14);
            isFirstLoad.current = false;
          }
        },
        (err) => {
          console.warn('Map geolocation tracking error:', err);
          if (err.code === err.PERMISSION_DENIED) {
            setGeoError('Location permission denied. Showing default city map.');
          } else {
            setGeoError('GPS coordinates unavailable. Showing city map.');
          }
          
          const fallbackLat = 20.2184;
          const fallbackLng = 85.7331;
          setUserLoc({ lat: fallbackLat, lng: fallbackLng });
          loadPoints(fallbackLat, fallbackLng);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGeoError('Geolocation tracking is not supported by your browser.');
      const fallbackLat = 20.2184;
      const fallbackLng = 85.7331;
      setUserLoc({ lat: fallbackLat, lng: fallbackLng });
      loadPoints(fallbackLat, fallbackLng);
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const toggleCat = (cat: MapCategory) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const visiblePoints = useMemo(() => {
    return points.filter((p) => {
      const matchesCat = activeCats.has(p.category);
      if (!matchesCat) return false;

      if (userLoc) {
        const dist = getDistance(userLoc.lat, userLoc.lng, Number(p.lat), Number(p.lng));
        return dist <= searchRadius;
      }
      return true;
    });
  }, [points, activeCats, userLoc, searchRadius]);

  const centerLat = userLoc?.lat ?? 20.2184;
  const centerLng = userLoc?.lng ?? 85.7331;

  // 1. Guaranteed Leaflet Map Initialization with Polling Retry logic
  useEffect(() => {
    if (loading) return;

    let checkInterval: any = null;
    let attempts = 0;

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !leafletMapContainerRef.current) return false;
      if (mapRef.current) return true; // Already initialized

      try {
        const map = L.map(leafletMapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false
        });
        mapRef.current = map;

        const isDark = document.documentElement.classList.contains('dark');
        const tileUrl = isDark 
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

        L.tileLayer(tileUrl, { maxZoom: 20 }).addTo(map);

        layersRef.current = L.layerGroup().addTo(map);

        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 300);

        return true;
      } catch (err) {
        console.warn("Leaflet init error:", err);
        return false;
      }
    };

    if (!initMap()) {
      checkInterval = setInterval(() => {
        attempts++;
        if (initMap() || attempts > 30) {
          clearInterval(checkInterval);
        }
      }, 200);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    };
  }, [loading]);

  // 2. Sync Markers & Radius Circle Overlay
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L || !layersRef.current) return;

    layersRef.current.clearLayers();

    if (userLoc) {
      L.circle([userLoc.lat, userLoc.lng], {
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.08,
        weight: 1.5,
        radius: searchRadius * 1000
      }).addTo(layersRef.current);

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div class="relative w-4.5 h-4.5 flex items-center justify-center"><div class="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-60"></div><div class="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md"></div></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      L.marker([userLoc.lat, userLoc.lng], { icon: userIcon }).addTo(layersRef.current);
    }

    visiblePoints.forEach(p => {
      const cfg = categoryConfig[p.category] || categoryConfig.hospital;
      const svg = categorySvgs[p.category] || categorySvgs.hospital;
      
      const markerIcon = L.divIcon({
        className: 'custom-poi-marker',
        html: `<div class="w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center text-white border-2 border-white shadow-lg transform hover:scale-110 active:scale-95 transition-all cursor-pointer">${svg}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      L.marker([Number(p.lat), Number(p.lng)], { icon: markerIcon })
        .on('click', () => setSelected(p))
        .addTo(layersRef.current);
    });

  }, [visiblePoints, userLoc, searchRadius]);

  return (
    <Screen>
      <ScreenHeader title="Smart City Map" subtitle="Points of interest & live services" onBack={onBack} />

      {/* Main Responsive Grid Layout for Desktop & Mobile */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-0 lg:gap-4 flex-1">
        
        {/* Left/Top Map Area Column */}
        <div className="lg:col-span-8 flex flex-col">
          {/* Radius Range selector bar */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-ink-100 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
              <Compass className="w-4 h-4 text-primary-500" />
              <span>Search Range:</span>
            </div>
            <div className="flex gap-1.5">
              {([3, 5, 10, 25] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setSearchRadius(r);
                    if (mapRef.current && userLoc) {
                      const targetZoom = r === 3 ? 15 : r === 5 ? 14 : r === 10 ? 13 : 11;
                      mapRef.current.setView([userLoc.lat, userLoc.lng], targetZoom);
                    }
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    searchRadius === r
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>

          {/* Layer toggles bar */}
          <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-ink-100 dark:border-slate-800">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => {
                  if (activeCats.size === Object.keys(categoryConfig).length) {
                    setActiveCats(new Set(['hospital']));
                  } else {
                    setActiveCats(new Set(Object.keys(categoryConfig) as MapCategory[]));
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeCats.size === Object.keys(categoryConfig).length
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {activeCats.size === Object.keys(categoryConfig).length ? '✓ All Layers' : 'Show All'}
              </button>

              {(Object.keys(categoryConfig) as MapCategory[]).map((cat) => {
                const cfg = categoryConfig[cat];
                const active = activeCats.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      active ? `${cfg.bg} text-white shadow-sm ring-2 ring-white/20` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Viewport Container */}
          <div className="relative h-[48vh] sm:h-[55vh] lg:h-[65vh] bg-slate-100 dark:bg-slate-950 overflow-hidden border-b lg:border-r border-slate-200 dark:border-slate-800 lg:rounded-2xl lg:m-3 shadow-inner">
            {geoError && (
              <div className="absolute top-4 left-4 right-16 bg-red-600/90 text-white p-2.5 rounded-xl shadow-xl z-[1000] border border-red-500/20 text-xs font-semibold backdrop-blur-sm">
                ⚠️ {geoError}
              </div>
            )}

            <div ref={leafletMapContainerRef} id="leaflet-map" className="w-full h-full z-0" />

            {/* Floating Zoom & Recenter Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-xl z-[1000] border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold flex items-center justify-center cursor-pointer transition-all active:scale-90 text-base"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold flex items-center justify-center cursor-pointer transition-all active:scale-90 text-base"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={() => {
                  if (mapRef.current && userLoc) {
                    const targetZoom = searchRadius === 3 ? 15 : searchRadius === 5 ? 14 : searchRadius === 10 ? 13 : 11;
                    mapRef.current.setView([userLoc.lat, userLoc.lng], targetZoom);
                  }
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer transition-all active:scale-90 text-[10px]"
                title="Recenter Map"
              >
                🎯
              </button>
            </div>
          </div>
        </div>

        {/* Right Column / Bottom Nearby POI List */}
        <div className="lg:col-span-4 px-4 py-4 overflow-y-auto max-h-[50vh] lg:max-h-[75vh]">
          <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mb-3 flex items-center justify-between">
            <span>Nearby POIs within {searchRadius} km</span>
            <span className="text-xs font-mono text-primary-600 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-full font-bold">
              {visiblePoints.length} found
            </span>
          </h2>

          <div className="space-y-2.5">
            {visiblePoints.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                No matching points of interest found in this radius. Try expanding the search range or selecting more layer chips above.
              </div>
            ) : (
              visiblePoints.map((p) => {
                const cfg = categoryConfig[p.category] || categoryConfig.hospital;
                const dist = userLoc ? getDistance(userLoc.lat, userLoc.lng, Number(p.lat), Number(p.lng)) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelected(p);
                      if (mapRef.current) {
                        mapRef.current.setView([Number(p.lat), Number(p.lng)], 16);
                      }
                    }}
                    className={`w-full bg-white dark:bg-slate-900 border rounded-2xl p-3.5 flex items-center gap-3 text-left shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                      selected?.id === p.id 
                        ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/20 dark:bg-primary-950/20' 
                        : 'border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                      <cfg.icon className="w-4 h-4 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">{p.name}</p>
                        {dist !== null && (
                          <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-full shrink-0">
                            {dist.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {p.address && p.address.includes('|||') ? p.address.split('|||')[0].trim() : p.address}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        {p.open_24h && (
                          <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> 24x7
                          </span>
                        )}
                        {p.phone && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <Phone className="w-3 h-3" /> {p.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <Navigation className="w-4 h-4 text-primary-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-4">
            <div className={`w-12 h-12 rounded-2xl ${categoryConfig[selected.category]?.bg || 'bg-primary-600'} flex items-center justify-center shadow-md`}>
              {(() => {
                const Icon = categoryConfig[selected.category]?.icon || Hospital;
                return <Icon className="w-6 h-6 text-white" />;
              })()}
            </div>
            
            {(() => {
              let cleanAddress = selected.address ?? '—';
              let extraInfo = null;

              if (selected.category === 'hospital' && selected.address && selected.address.includes('|||')) {
                try {
                  const parts = selected.address.split('|||');
                  cleanAddress = parts[0].trim();
                  extraInfo = JSON.parse(parts[1].trim());
                } catch (e) {
                  console.warn(e);
                }
              }

              return (
                <div className="space-y-3">
                  <InfoRow icon={MapPin} label="Address" value={cleanAddress} />
                  <InfoRow icon={Phone} label="Phone Contact" value={selected.phone ?? '—'} />
                  <InfoRow icon={Clock} label="Operational Hours" value={selected.open_24h ? 'Open 24x7' : '9 AM – 6 PM'} />
                  
                  {extraInfo && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2 mt-2">
                      <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Live Facility Capacity</p>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white/50 dark:bg-slate-900/50 p-2 rounded-xl border border-emerald-500/10">
                          <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{extraInfo.bedsAvailable} / {extraInfo.bedsTotal}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Beds Available</p>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-900/50 p-2 rounded-xl border border-emerald-500/10">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize mt-1.5">ICU & Emergency</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Critical Status</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-2 pt-2">
              <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors shadow-md text-center"
              >
                <Navigation className="w-4 h-4" /> Open Turn-by-Turn Directions
              </a>
              {selected.phone && (
                <a 
                  href={`tel:${selected.phone}`}
                  className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                >
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Screen>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}
