import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  MapPin, Phone, Clock, Navigation, Hospital, Shield, Flame, SquareParking,
  Building2, Pill, TreePine, Bus, X, Compass, Search, Layers, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Modal } from '@/components/Modal';
import type { MapPoint, MapCategory } from '@/lib/types';
import { VERIFIED_BHUBANESWAR_POINTS } from '@/lib/verifiedBhubaneswarPoints';

const categoryConfig: Record<MapCategory, { icon: typeof Hospital; color: string; bg: string; label: string }> = {
  hospital: { icon: Hospital, color: 'text-error-500', bg: 'bg-error-500', label: 'Hospitals' },
  police: { icon: Shield, color: 'text-secondary-600', bg: 'bg-secondary-600', label: 'Police' },
  fire: { icon: Flame, color: 'text-accent-500', bg: 'bg-accent-500', label: 'Fire' },
  pharmacy: { icon: Pill, color: 'text-primary-500', bg: 'bg-primary-500', label: 'Pharmacies' },
  transit: { icon: Bus, color: 'text-secondary-500', bg: 'bg-secondary-500', label: 'Transit Hubs' },
  parking: { icon: SquareParking, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-700', label: 'Parking' },
  government: { icon: Building2, color: 'text-primary-600', bg: 'bg-primary-600', label: 'Govt Offices' },
  park: { icon: TreePine, color: 'text-emerald-500', bg: 'bg-emerald-600', label: 'Parks' },
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

const TILE_LAYERS = {
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 20
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19
  }
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
  const [activeCats, setActiveCats] = useState<Set<MapCategory>>(() => {
    return initialCategory 
      ? new Set([initialCategory]) 
      : new Set(Object.keys(categoryConfig) as MapCategory[]);
  });
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mapMode, setMapMode] = useState<'streets' | 'satellite'>('streets');
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoTimeoutRef = useRef<any>(null);

  const showGeoNotice = (msg: string) => {
    setGeoError(msg);
    if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);
    geoTimeoutRef.current = setTimeout(() => {
      setGeoError(null);
    }, 4000);
  };

  useEffect(() => {
    if (initialCategory) {
      setActiveCats(new Set([initialCategory]));
    }
  }, [initialCategory]);

  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layersRef = useRef<any>(null);
  const leafletMapContainerRef = useRef<HTMLDivElement | null>(null);
  const isFirstLoad = useRef(true);

  // Fast, reliable municipal POI load (Supabase + Verified Ground Directory)
  const loadPoints = useCallback(async () => {
    try {
      let basePoints: MapPoint[] = [];
      if (supabase) {
        const { data, error } = await supabase.from('map_points').select('*');
        if (!error && data && data.length > 0) {
          basePoints = data;
        }
      }

      // Merge verified ground directory, avoiding duplicate names
      const existingNames = new Set(basePoints.map(p => p.name.toLowerCase().trim()));
      const filteredVerified = VERIFIED_BHUBANESWAR_POINTS.filter(
        vp => !existingNames.has(vp.name.toLowerCase().trim())
      );
      setPoints([...basePoints, ...filteredVerified]);
    } catch (e) {
      console.warn("Notice: Loaded baseline municipal POIs:", e);
      setPoints(VERIFIED_BHUBANESWAR_POINTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  // Track user geolocation
  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLoc({ lat, lng });
          setGeoError(null);
          
          if (isFirstLoad.current && mapRef.current) {
            mapRef.current.setView([lat, lng], 14);
            isFirstLoad.current = false;
          }
        },
        (err) => {
          console.warn('Map geolocation tracking info:', err);
          if (err.code === err.PERMISSION_DENIED) {
            showGeoNotice('Location permission not granted. Centering on city center.');
          }
          const fallbackLat = 20.2961;
          const fallbackLng = 85.8245;
          setUserLoc({ lat: fallbackLat, lng: fallbackLng });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    } else {
      const fallbackLat = 20.2961;
      const fallbackLng = 85.8245;
      setUserLoc({ lat: fallbackLat, lng: fallbackLng });
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (geoTimeoutRef.current) {
        clearTimeout(geoTimeoutRef.current);
      }
    };
  }, []);

  const toggleCat = (cat: MapCategory) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const selectAllCats = () => {
    if (activeCats.size === Object.keys(categoryConfig).length) {
      setActiveCats(new Set(['hospital']));
    } else {
      setActiveCats(new Set(Object.keys(categoryConfig) as MapCategory[]));
    }
  };

  // Filter & sort visible points
  const visiblePoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return points.filter((p) => {
      if (!activeCats.has(p.category)) return false;

      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchAddr = p.address ? p.address.toLowerCase().includes(q) : false;
        const matchCat = categoryConfig[p.category]?.label.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchCat) return false;
      }

      if (!q && searchRadius > 0 && userLoc) {
        const dist = getDistance(userLoc.lat, userLoc.lng, Number(p.lat), Number(p.lng));
        return dist <= searchRadius;
      }

      return true;
    }).sort((a, b) => {
      if (!userLoc) return 0;
      const distA = getDistance(userLoc.lat, userLoc.lng, Number(a.lat), Number(a.lng));
      const distB = getDistance(userLoc.lat, userLoc.lng, Number(b.lat), Number(b.lng));
      return distA - distB;
    });
  }, [points, activeCats, searchQuery, searchRadius, userLoc]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    points.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [points]);

  const centerLat = userLoc?.lat ?? 20.2961;
  const centerLng = userLoc?.lng ?? 85.8245;

  // Initialize Leaflet Map
  useEffect(() => {
    if (loading) return;

    let checkInterval: any = null;
    let attempts = 0;

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !leafletMapContainerRef.current) return false;
      if (mapRef.current) return true;

      try {
        const map = L.map(leafletMapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false
        });
        mapRef.current = map;

        const tileCfg = TILE_LAYERS[mapMode];
        const tileLayer = L.tileLayer(tileCfg.url, {
          maxZoom: tileCfg.maxZoom,
          subdomains: tileCfg.subdomains,
          attribution: tileCfg.attribution
        });

        tileLayer.addTo(map);
        tileLayerRef.current = tileLayer;

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
        tileLayerRef.current = null;
      }
    };
  }, [loading]);

  // Handle map mode (Streets vs Satellite) toggle
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const tileCfg = TILE_LAYERS[mapMode];
    const newTileLayer = L.tileLayer(tileCfg.url, {
      maxZoom: tileCfg.maxZoom,
      subdomains: tileCfg.subdomains,
      attribution: tileCfg.attribution
    });

    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [mapMode]);

  // Sync Markers, Circle Overlay & Leaflet Popups
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L || !layersRef.current) return;

    layersRef.current.clearLayers();

    // User location pulse & radius boundary
    if (userLoc) {
      if (searchRadius > 0 && !searchQuery) {
        L.circle([userLoc.lat, userLoc.lng], {
          color: '#059669',
          fillColor: '#059669',
          fillOpacity: 0.05,
          weight: 1.5,
          dashArray: '4, 4',
          radius: searchRadius * 1000
        }).addTo(layersRef.current);
      }

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div class="relative w-5 h-5 flex items-center justify-center"><div class="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60"></div><div class="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-md"></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([userLoc.lat, userLoc.lng], { icon: userIcon }).addTo(layersRef.current);
    }

    // Place POI markers with custom popups
    visiblePoints.forEach(p => {
      const cfg = categoryConfig[p.category] || categoryConfig.hospital;
      const svg = categorySvgs[p.category] || categorySvgs.hospital;
      const dist = userLoc ? getDistance(userLoc.lat, userLoc.lng, Number(p.lat), Number(p.lng)) : null;
      const cleanAddr = p.address ? (p.address.includes('|||') ? p.address.split('|||')[0].trim() : p.address) : '';

      const markerIcon = L.divIcon({
        className: 'custom-poi-marker',
        html: `<div class="w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center text-white border-2 border-white shadow-lg transform hover:scale-115 active:scale-95 transition-all cursor-pointer">${svg}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupHtml = `
        <div style="padding: 12px; min-width: 210px; max-width: 260px; font-family: inherit;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 9999px; background: rgba(5,150,105,0.15); color: #059669;">
              ${cfg.label}
            </span>
            ${dist !== null ? `<span style="font-size: 10px; font-weight: 800; color: #0284c7; font-family: monospace;">${dist.toFixed(1)} km</span>` : ''}
          </div>
          <h4 style="font-size: 13px; font-weight: 800; margin: 0 0 4px 0; color: #0f172a; line-height: 1.25;">
            ${p.name}
          </h4>
          ${cleanAddr ? `<p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${cleanAddr}</p>` : ''}
          <div style="display: flex; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.06);">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; padding: 6px 10px; background: #059669; color: white; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              Directions ↗
            </a>
          </div>
        </div>
      `;

      L.marker([Number(p.lat), Number(p.lng)], { icon: markerIcon })
        .bindPopup(popupHtml, { maxWidth: 280, closeButton: false })
        .on('click', () => {
          setSelected(p);
        })
        .addTo(layersRef.current);
    });

  }, [visiblePoints, userLoc, searchRadius, searchQuery]);

  return (
    <Screen>
      <ScreenHeader title="Smart City Map" subtitle="Civic Points of Interest & Verified Services" onBack={onBack} />

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-0 lg:gap-4 flex-1">
        
        {/* Left Column: Interactive Map Viewport */}
        <div className="lg:col-span-8 flex flex-col">

          {/* Search & Radius Filter Bar */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-ink-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search verified places (e.g. AIIMS, Police, Apollo)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Radius Range Selector */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 hidden sm:inline">Range:</span>
              <div className="flex gap-1 p-0.5 bg-slate-200/60 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                {([3, 5, 10, 25, 0] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setSearchRadius(r);
                      if (mapRef.current && userLoc) {
                        const targetZoom = r === 3 ? 15 : r === 5 ? 14 : r === 10 ? 13 : r === 25 ? 12 : 11;
                        mapRef.current.setView([userLoc.lat, userLoc.lng], targetZoom);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      searchRadius === r
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {r === 0 ? 'All' : `${r} km`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-ink-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-0.5">
              <button
                onClick={selectAllCats}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeCats.size === Object.keys(categoryConfig).length
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{activeCats.size === Object.keys(categoryConfig).length ? '✓ All' : 'Show All'}</span>
                <span className="text-[10px] font-mono opacity-80">({points.length})</span>
              </button>

              {(Object.keys(categoryConfig) as MapCategory[]).map((cat) => {
                const cfg = categoryConfig[cat];
                const active = activeCats.has(cat);
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      active 
                        ? `${cfg.bg} text-white border-transparent shadow-xs ring-1 ring-white/20 font-bold` 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    <span>{cfg.label}</span>
                    <span className={`text-[10px] font-mono px-1 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Viewport Container */}
          <div className="relative h-[42vh] sm:h-[50vh] lg:h-[calc(100vh-13rem)] bg-slate-100 dark:bg-slate-950 overflow-hidden border-b lg:border-r border-slate-200 dark:border-slate-800 lg:rounded-2xl lg:m-3 shadow-inner">
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

            {/* Bottom-left POI Count Badge on Map */}
            <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-md text-white text-[11px] font-bold shadow-lg border border-white/10 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary-400" />
                <span>{visiblePoints.length} verified places</span>
              </span>
            </div>

            {/* Floating Map Controls (Zoom, GPS, Satellite Toggle) */}
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-xl z-[1000] border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 active:scale-90 text-white font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs text-base"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="w-8 h-8 rounded-lg bg-primary-600 hover:bg-primary-700 active:scale-90 text-white font-bold flex items-center justify-center cursor-pointer transition-all shadow-xs text-base"
                title="Zoom Out"
              >
                -
              </button>

              <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

              <button
                onClick={() => {
                  if (mapRef.current && userLoc) {
                    mapRef.current.flyTo([userLoc.lat, userLoc.lng], 15, { duration: 0.8 });
                  }
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer transition-all active:scale-90 text-xs"
                title="Recenter on My Location"
              >
                🎯
              </button>

              <button
                onClick={() => setMapMode(m => m === 'streets' ? 'satellite' : 'streets')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-90 text-xs ${
                  mapMode === 'satellite'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
                title={mapMode === 'streets' ? "Switch to Satellite Imagery" : "Switch to Streets View"}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Verified Municipal Places List */}
        <div className="lg:col-span-4 px-4 py-3 pb-28 lg:pb-8 lg:overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Verified Civic Directory
              </h2>
              <p className="text-[11px] text-slate-400">
                {searchRadius > 0 && !searchQuery ? `Within ${searchRadius} km of your area` : 'City-wide ground directory'}
              </p>
            </div>
            <span className="text-xs font-mono text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 border border-primary-500/20 px-2.5 py-0.5 rounded-full font-bold shrink-0">
              {visiblePoints.length} found
            </span>
          </div>

          <div className="space-y-2.5">
            {visiblePoints.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 space-y-2">
                <Compass className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No matching places found</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Try clearing the search query, selecting more categories, or increasing the search range.
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 px-3 py-1 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold cursor-pointer hover:underline"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              visiblePoints.map((p) => {
                const cfg = categoryConfig[p.category] || categoryConfig.hospital;
                const dist = userLoc ? getDistance(userLoc.lat, userLoc.lng, Number(p.lat), Number(p.lng)) : null;
                const cleanAddr = p.address ? (p.address.includes('|||') ? p.address.split('|||')[0].trim() : p.address) : '';

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelected(p);
                      if (mapRef.current) {
                        mapRef.current.flyTo([Number(p.lat), Number(p.lng)], 16, { duration: 0.8 });
                      }
                    }}
                    className={`w-full bg-white dark:bg-slate-900 border rounded-2xl p-3.5 flex items-start gap-3 text-left shadow-2xs hover:shadow-md transition-all group cursor-pointer active:scale-[0.99] touch-manipulation ${
                      selected?.id === p.id 
                        ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/15 dark:bg-primary-950/30' 
                        : 'border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5 shadow-xs text-white`}>
                      <cfg.icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight group-hover:text-primary-600 transition-colors">
                          {p.name}
                        </p>
                        {dist !== null && (
                          <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold font-mono bg-primary-50 dark:bg-primary-950/60 px-1.5 py-0.5 rounded shrink-0">
                            {dist.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      
                      {cleanAddr && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                          {cleanAddr}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {cfg.label}
                        </span>
                        {p.open_24h && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-500/20">
                            <Clock className="w-2.5 h-2.5" /> 24x7
                          </span>
                        )}
                        {p.phone && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" /> {p.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950/40 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 transition-all active:scale-90"
                      title="Open Directions in Google Maps"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* POI Details Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-4 text-slate-800 dark:text-white">
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-2xl ${categoryConfig[selected.category]?.bg || 'bg-primary-600'} flex items-center justify-center shadow-md text-white`}>
                {(() => {
                  const Icon = categoryConfig[selected.category]?.icon || Hospital;
                  return <Icon className="w-6 h-6" />;
                })()}
              </div>

              <span className="text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 border border-primary-500/30 px-3 py-1 rounded-full">
                {categoryConfig[selected.category]?.label || 'Civic Amenity'}
              </span>
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
                  <InfoRow icon={Phone} label="Phone Contact" value={selected.phone ?? 'Not available'} />
                  <InfoRow icon={Clock} label="Operational Hours" value={selected.open_24h ? 'Open 24x7 Emergency Service' : 'Regular Municipal Hours'} />
                  
                  {extraInfo && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-2 mt-2">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Live Facility Capacity</p>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-500/10">
                          <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{extraInfo.bedsAvailable} / {extraInfo.bedsTotal}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Beds Available</p>
                        </div>
                        <div className="bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-500/10">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize mt-1.5">ICU & Emergency</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">Critical Care</p>
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
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 text-center"
              >
                <Navigation className="w-4 h-4" /> Open Turn-by-Turn Directions
              </a>
              {selected.phone && (
                <a 
                  href={`tel:${selected.phone}`}
                  className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 active:scale-95"
                  title="Call Facility"
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
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}
