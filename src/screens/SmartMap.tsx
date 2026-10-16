import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  MapPin, Phone, Clock, Navigation, Hospital, Shield, Flame, SquareParking,
  Building2, Pill, TreePine, Bus, X, Compass, Check, RefreshCw, Radio, CheckCircle2, Globe2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Modal } from '@/components/Modal';
import type { MapPoint, MapCategory } from '@/lib/types';
import { VERIFIED_BHUBANESWAR_POINTS } from '@/lib/verifiedBhubaneswarPoints';
import { fetchLiveRealTimePlaces } from '@/lib/realTimePlacesService';

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
  const [isSyncingLive, setIsSyncingLive] = useState<boolean>(false);
  const [liveSyncTime, setLiveSyncTime] = useState<string | null>(null);
  const [liveOsmCount, setLiveOsmCount] = useState<number>(0);
  const geoTimeoutRef = useRef<any>(null);
  const lastFetchedLocRef = useRef<{ lat: number; lng: number } | null>(null);

  const showGeoNotice = (msg: string) => {
    setGeoError(msg);
    if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
    geoTimeoutRef.current = setTimeout(() => {
      setGeoError(null);
    }, 4500);
  };

  useEffect(() => {
    if (initialCategory) {
      setActiveCats(new Set([initialCategory]));
    }
  }, [initialCategory]);

  const mapRef = useRef<any>(null);
  const layersRef = useRef<any>(null);
  const leafletMapContainerRef = useRef<HTMLDivElement | null>(null);
  const isFirstLoad = useRef(true);

  const loadPoints = useCallback(async (lat?: number, lng?: number, forceLiveFetch = false) => {
    try {
      let basePoints: MapPoint[] = [];
      if (supabase) {
        const { data, error } = await supabase.from('map_points').select('*');
        if (!error && data && data.length > 0) {
          basePoints = data;
        }
      }

      // Merge verified municipal POIs (avoiding duplicate names)
      const existingNames = new Set(basePoints.map(p => p.name.toLowerCase().trim()));
      const filteredVerified = VERIFIED_BHUBANESWAR_POINTS.filter(
        vp => !existingNames.has(vp.name.toLowerCase().trim())
      );
      const combinedBase: MapPoint[] = [...basePoints, ...filteredVerified];

      // Update base points immediately
      setPoints(prev => {
        const liveExisting = prev.filter(p => p.isLiveRealTime);
        const map = new Map<string, MapPoint>();
        combinedBase.forEach(p => map.set(p.id, p));
        liveExisting.forEach(lp => {
          if (!map.has(lp.id)) map.set(lp.id, lp);
        });
        return Array.from(map.values());
      });

      // Fetch real-time live amenities from OpenStreetMap Overpass & Nominatim
      const targetLat = lat ?? 20.2184;
      const targetLng = lng ?? 85.7331;

      // Check if we already fetched recently within 400m unless forced
      const prevLoc = lastFetchedLocRef.current;
      const distFromLast = prevLoc ? getDistance(prevLoc.lat, prevLoc.lng, targetLat, targetLng) : 999;

      if (forceLiveFetch || distFromLast > 0.4 || liveOsmCount === 0) {
        lastFetchedLocRef.current = { lat: targetLat, lng: targetLng };
        setIsSyncingLive(true);
        try {
          const liveResult = await fetchLiveRealTimePlaces(targetLat, targetLng, Math.max(searchRadius * 1000, 5000));
          if (liveResult.points.length > 0) {
            setLiveOsmCount(liveResult.points.length);
            setLiveSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

            setPoints(prev => {
              const pointMap = new Map<string, MapPoint>();
              // Keep verified baseline
              combinedBase.forEach(p => {
                const key = `${Number(p.lat).toFixed(4)}_${Number(p.lng).toFixed(4)}`;
                pointMap.set(key, p);
              });

              // Add live real-time OSM points
              liveResult.points.forEach(lp => {
                const key = `${Number(lp.lat).toFixed(4)}_${Number(lp.lng).toFixed(4)}`;
                if (!pointMap.has(key)) {
                  pointMap.set(key, lp);
                }
              });

              return Array.from(pointMap.values());
            });
          }
        } catch (fetchErr) {
          console.warn("Live OSM telemetry query error:", fetchErr);
        } finally {
          setIsSyncingLive(false);
        }
      }
    } catch (e) {
      console.warn("Notice: Loaded baseline ground POIs:", e);
      setPoints(VERIFIED_BHUBANESWAR_POINTS);
    } finally {
      setLoading(false);
    }
  }, [searchRadius, liveOsmCount]);

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
          console.warn('Map geolocation tracking info:', err);
          if (err.code === err.PERMISSION_DENIED) {
            showGeoNotice('Location permission not granted. Displaying city map.');
          } else {
            showGeoNotice('GPS signal searching. Displaying city map.');
          }
          
          const fallbackLat = 20.2184;
          const fallbackLng = 85.7331;
          setUserLoc({ lat: fallbackLat, lng: fallbackLng });
          loadPoints(fallbackLat, fallbackLng);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    } else {
      showGeoNotice('Showing default city map.');
      const fallbackLat = 20.2184;
      const fallbackLng = 85.7331;
      setUserLoc({ lat: fallbackLat, lng: fallbackLng });
      loadPoints(fallbackLat, fallbackLng);
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (geoTimeoutRef.current) {
        clearTimeout(geoTimeoutRef.current);
      }
    };
  }, [loadPoints]);

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

        // Reliable public map tiles that do not require API keys or display watermarks
        const osmFranceUrl = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
        const esriStreetUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

        const tileLayer = L.tileLayer(osmFranceUrl, {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          attribution: '&copy; OpenStreetMap contributors, ESRI'
        });

        tileLayer.on('tileerror', () => {
          if (tileLayer._url !== esriStreetUrl) {
            tileLayer.setUrl(esriStreetUrl);
          }
        });

        tileLayer.addTo(map);

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
          {/* Real-time Status & Sync Bar */}
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSyncingLive ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSyncingLive ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                {isSyncingLive ? 'Querying Live OpenStreetMap Nodes...' : '🟢 Live OpenStreetMap Real-Time Grid'}
              </span>
              {liveSyncTime && (
                <span className="hidden sm:inline text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                  (Synced {liveSyncTime})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                {liveOsmCount > 0 ? `${liveOsmCount} Live OSM POIs` : '100% Real-World Data'}
              </span>
              <button
                onClick={() => {
                  if (userLoc) {
                    loadPoints(userLoc.lat, userLoc.lng, true);
                  } else {
                    loadPoints(20.2184, 85.7331, true);
                  }
                }}
                disabled={isSyncingLive}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-slate-800 text-[11px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Fetch live POIs from OpenStreetMap Overpass"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingLive ? 'animate-spin' : ''}`} />
                <span>Refresh Live</span>
              </button>
            </div>
          </div>

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
              <div className="absolute top-4 left-4 right-16 bg-slate-900/95 dark:bg-slate-800/95 text-slate-100 p-2.5 rounded-xl shadow-2xl z-[1000] border border-white/10 text-xs font-medium backdrop-blur-md flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <Compass className="w-4 h-4 text-primary-400 shrink-0" />
                  <span className="truncate">{geoError}</span>
                </div>
                <button
                  onClick={() => setGeoError(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
                      
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {p.isLiveRealTime ? (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" /> Live OSM
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" /> Verified POI
                          </span>
                        )}
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
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-2xl ${categoryConfig[selected.category]?.bg || 'bg-primary-600'} flex items-center justify-center shadow-md`}>
                {(() => {
                  const Icon = categoryConfig[selected.category]?.icon || Hospital;
                  return <Icon className="w-6 h-6 text-white" />;
                })()}
              </div>

              {selected.isLiveRealTime ? (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Real-Time OSM Node
                </span>
              ) : (
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Verified Ground Directory
                </span>
              )}
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
