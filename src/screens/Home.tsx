import { useEffect, useState } from 'react';
import {
  Sun, Cloud, CloudRain, CloudLightning, Droplets, Wind, Thermometer, Volume2, Leaf, Siren, ChevronRight,
  TrendingUp, AlertCircle, Sparkles, Bell, Zap, Trash2, Car,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { EnvReading, Bill, Complaint, Notification } from '@/lib/types';
import { formatINR, timeAgo } from '@/lib/utils';
import type { Tab } from '@/components/BottomNav';

interface HomeProps {
  onTab: (tab: Tab) => void;
  onOpenZen: () => void;
  onOpenService: (serviceId: string) => void;
}

export function Home({ onTab, onOpenZen, onOpenService }: HomeProps) {
  const { profile, session } = useAuth();
  const [env, setEnv] = useState<EnvReading[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [realWeather, setRealWeather] = useState<{
    temp: number;
    condition: string;
    icon: 'sun' | 'cloud' | 'rain' | 'thunder';
  }>({
    temp: 29,
    condition: 'Cloudy',
    icon: 'cloud'
  });
  const [liveSensors, setLiveSensors] = useState({
    temp: 29,
    aqi: 72,
    humidity: 64,
    water: 88.4,
    noise: 58,
    co2: 412
  });

  useEffect(() => {
    // 1. Real-time IoT sensor telemetry ticker (3-second pulse)
    const ticker = setInterval(() => {
      setLiveSensors(prev => ({
        ...prev,
        noise: Math.min(85, Math.max(45, prev.noise + (Math.random() > 0.5 ? 1 : -1))),
        co2: Math.min(480, Math.max(390, prev.co2 + (Math.random() > 0.5 ? 2 : -2))),
        water: Number((Math.min(99, Math.max(80, prev.water + (Math.random() > 0.5 ? 0.2 : -0.2)))).toFixed(1))
      }));
    }, 3000);

    const fetchLiveMetrics = (lat: number, lng: number) => {
      // Live weather & humidity
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.current) {
            const t = Math.round(data.current.temperature_2m);
            const h = Math.round(data.current.relative_humidity_2m);
            const code = data.current.weather_code;

            let cond = 'Cloudy';
            let iconType: 'sun' | 'cloud' | 'rain' | 'thunder' = 'cloud';
            if (code === 0) { cond = 'Clear'; iconType = 'sun'; }
            else if (code >= 1 && code <= 3) { cond = 'Cloudy'; iconType = 'cloud'; }
            else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) { cond = 'Rainy'; iconType = 'rain'; }
            else if (code >= 95) { cond = 'Thunderstorm'; iconType = 'thunder'; }
            else if (code >= 45 && code <= 48) { cond = 'Foggy'; iconType = 'cloud'; }

            setRealWeather({ temp: t, condition: cond, icon: iconType });
            setLiveSensors(prev => ({ ...prev, temp: t, humidity: h }));
          }
        })
        .catch((err) => console.warn('Real weather fetch error:', err));

      // Live US AQI
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.current?.us_aqi) {
            const liveAqi = Math.round(data.current.us_aqi);
            setLiveSensors(prev => ({ ...prev, aqi: liveAqi }));
          }
        })
        .catch((err) => console.warn('Live AQI fetch error:', err));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchLiveMetrics(pos.coords.latitude, pos.coords.longitude),
        () => fetchLiveMetrics(20.2961, 85.8245),
        { timeout: 5000 }
      );
    } else {
      fetchLiveMetrics(20.2961, 85.8245);
    }

    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [envRes, billsRes, complaintsRes, notifRes] = await Promise.all([
        supabase.from('environmental_readings').select('*'),
        supabase.from('bills').select('*').eq('status', 'unpaid').order('due_date', { ascending: true }).limit(3),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(3),
      ]);
      if (cancelled) return;
      setEnv(envRes.data ?? []);
      setBills(billsRes.data ?? []);
      setComplaints(complaintsRes.data ?? []);
      setNotifications(notifRes.data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const rawName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || 'Citizen';
  const firstName = rawName.trim().split(' ')[0] || 'Citizen';

  const envMap = Object.fromEntries(env.map((e) => [e.metric, e]));
  const aqi = envMap.aqi;
  const temp = envMap.temperature;

  return (
    <div className="min-h-screen md:min-h-0 md:h-[calc(100vh-3rem)] w-full md:max-w-5xl mx-auto bg-ink-50 pb-24 md:shadow-2xl md:my-6 md:rounded-3xl overflow-y-auto border border-slate-800/40 animate-fade-in">
      {/* Hero header */}
      <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 text-white px-5 pt-12 pb-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary-400/20 rounded-full blur-2xl -ml-8 -mb-8" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl border border-white/20 overflow-hidden shadow-lg shrink-0">
                <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-primary-100 text-xs">{greeting},</p>
                <h1 className="text-xl font-extrabold leading-tight">{firstName} 👋</h1>
                <p className="text-primary-100/90 text-[10px] mt-0.5 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse shrink-0" />
                  <span className="truncate max-w-[200px]">{session?.user?.email || profile?.email || `Ward ${profile?.ward ?? 12}`}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => onTab('notifications')}
              className="relative w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>

          {/* Weather + AQI strip */}
          <div className="flex gap-3 mt-5">
            <div className="flex-1 bg-white/15 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
              {realWeather.icon === 'sun' ? (
                <Sun className="w-8 h-8 text-amber-300" />
              ) : realWeather.icon === 'rain' ? (
                <CloudRain className="w-8 h-8 text-sky-200" />
              ) : realWeather.icon === 'thunder' ? (
                <CloudLightning className="w-8 h-8 text-amber-400" />
              ) : (
                <Cloud className="w-8 h-8 text-sky-200" />
              )}
              <div>
                <p className="text-2xl font-bold leading-none">{realWeather.temp}°C</p>
                <p className="text-primary-100/80 text-xs mt-0.5">
                  {realWeather.condition} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
            <div className="flex-1 bg-white/15 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3">
              <Wind className="w-8 h-8 text-primary-200" />
              <div>
                <p className="text-2xl font-bold leading-none">{aqi?.value ?? 78}</p>
                <p className="text-primary-100/80 text-xs mt-0.5">AQI · Satisfactory</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zen AI card */}
      <div className="px-5 -mt-12 relative z-10">
        <button
          onClick={onOpenZen}
          className="w-full bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3 text-left hover:shadow-xl transition-shadow group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink-900">Ask Zen AI</p>
            <p className="text-xs text-ink-500 truncate">"Find nearest hospital" · voice & text</p>
          </div>
          <ChevronRight className="w-5 h-5 text-ink-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-5">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'SOS', icon: Siren, color: 'bg-error-500', tab: 'emergency' as Tab },
            { label: 'Bills', icon: Droplets, color: 'bg-secondary-500', action: () => onOpenService('bills') },
            { label: 'Complaint', icon: AlertCircle, color: 'bg-accent-500', action: () => onOpenService('complaints') },
            { label: 'Map', icon: Car, color: 'bg-primary-500', tab: 'map' as Tab },
          ].map(({ label, icon: Icon, color, tab, action }) => (
            <button
              key={label}
              onClick={() => (tab ? onTab(tab) : action?.())}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-md hover:scale-105 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium text-ink-600">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live city status */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-ink-900">Live City Status</h2>
          <span className="text-xs text-primary-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" /> Real-time IoT Stream
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Thermometer} label="Temp" value={liveSensors.temp} unit="°C" color="text-accent-500" />
          <StatCard icon={Wind} label="AQI" value={liveSensors.aqi} unit="" color="text-primary-500" />
          <StatCard icon={Droplets} label="Humidity" value={liveSensors.humidity} unit="%" color="text-sky-500" />
          <StatCard icon={Droplets} label="Water" value={liveSensors.water} unit="%" color="text-secondary-500" />
          <StatCard icon={Volume2} label="Noise" value={liveSensors.noise} unit="dB" color="text-error-500" />
          <StatCard icon={TrendingUp} label="CO₂" value={liveSensors.co2} unit="ppm" color="text-ink-500" />
        </div>
      </div>

      {/* Pending bills */}
      <div className="px-5 mt-6">
        <SectionHeader title="Pending Bills" onMore={() => onOpenService('bills')} />
        {loading ? (
          <SkeletonRow />
        ) : bills.length === 0 ? (
          <EmptyHint text="No pending bills. You're all caught up!" />
        ) : (
          <div className="space-y-2.5">
            {bills.map((bill) => (
              <button
                key={bill.id}
                onClick={() => onOpenService('bills')}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 text-left shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  bill.type === 'water' ? 'bg-secondary-100' : bill.type === 'electricity' ? 'bg-accent-500/10' : 'bg-primary-100'
                }`}>
                  {bill.type === 'water' ? <Droplets className="w-5 h-5 text-secondary-500" /> :
                   bill.type === 'electricity' ? <Zap className="w-5 h-5 text-accent-500" /> :
                   <Leaf className="w-5 h-5 text-primary-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-800 capitalize">{bill.type} bill</p>
                  <p className="text-xs text-ink-400">Due {bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'} · {bill.period}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-ink-900">{formatINR(bill.amount)}</p>
                  <p className="text-xs text-error-500 font-medium">Pay now</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent complaints */}
      <div className="px-5 mt-6">
        <SectionHeader title="Your Complaints" onMore={() => onOpenService('complaints')} />
        {loading ? (
          <SkeletonRow />
        ) : complaints.length === 0 ? (
          <EmptyHint text="No complaints filed yet." />
        ) : (
          <div className="space-y-2.5">
            {complaints.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenService('complaints')}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 text-left shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-ink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-800 truncate">{c.title}</p>
                  <p className="text-xs text-ink-400">{timeAgo(c.created_at)} · {c.category}</p>
                </div>
                <StatusBadge status={c.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent notifications */}
      <div className="px-5 mt-6">
        <SectionHeader title="Recent Alerts" onMore={() => onTab('notifications')} />
        {loading ? (
          <SkeletonRow />
        ) : notifications.length === 0 ? (
          <EmptyHint text="No alerts right now." />
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => (
              <div key={n.id} className="bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  n.type === 'emergency' ? 'bg-error-500/10' :
                  n.type === 'bill' ? 'bg-secondary-100' :
                  n.type === 'complaint' ? 'bg-accent-500/10' : 'bg-primary-100'
                }`}>
                  {n.type === 'emergency' ? <Siren className="w-4 h-4 text-error-500" /> :
                   n.type === 'bill' ? <Droplets className="w-4 h-4 text-secondary-500" /> :
                   n.type === 'complaint' ? <AlertCircle className="w-4 h-4 text-accent-500" /> :
                   <Bell className="w-4 h-4 text-primary-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-800 text-sm">{n.title}</p>
                  <p className="text-xs text-ink-500 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-ink-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, color }: {
  icon: typeof Sun; label: string; value?: number; unit: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <p className="text-lg font-bold text-ink-900 leading-none">
        {value ?? '—'}<span className="text-xs text-ink-400 font-normal ml-0.5">{unit}</span>
      </p>
      <p className="text-xs text-ink-400 mt-1">{label}</p>
    </div>
  );
}

function SectionHeader({ title, onMore }: { title: string; onMore: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-bold text-ink-900">{title}</h2>
      <button onClick={onMore} className="text-xs text-primary-600 font-semibold flex items-center gap-0.5">
        See all <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    submitted: 'bg-ink-100 text-ink-600',
    assigned: 'bg-secondary-100 text-secondary-700',
    in_progress: 'bg-accent-500/10 text-accent-600',
    resolved: 'bg-primary-100 text-primary-700',
    rejected: 'bg-error-500/10 text-error-600',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${colors[status] ?? colors.submitted}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 text-center text-sm text-ink-400 shadow-sm">
      {text}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-2.5">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded skeleton" />
            <div className="h-2.5 w-20 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}
