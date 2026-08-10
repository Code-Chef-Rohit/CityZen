import { useEffect, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ServiceIcon } from '@/components/ServiceIcon';
import { Screen, ScreenHeader } from '@/components/Screen';
import type { Service } from '@/lib/types';

const categories = ['Living', 'Utilities', 'Transport', 'Healthcare', 'Government', 'Property', 'Emergency', 'Environment', 'Complaints'];

interface ExploreProps {
  onBack: () => void;
  onOpenService: (serviceId: string) => void;
}

export function Explore({ onBack, onOpenService }: ExploreProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('services').select('*').order('category').then(({ data }) => {
      setServices(data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = services.filter((s) => {
    const matchesCat = activeCat === 'All' || s.category === activeCat;
    const matchesQuery =
      !query ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.description ?? '').toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <Screen>
      <ScreenHeader title="Explore Services" subtitle="Browse all city services" onBack={onBack} />

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text"
            placeholder="Search services…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 transition-all"
          />
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCat === cat
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-ink-500 border border-ink-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 h-32 skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenService(s.id)}
                className="bg-white rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <ServiceIcon name={s.icon} className="w-5 h-5 text-primary-600" />
                </div>
                <p className="font-semibold text-ink-900 text-sm leading-tight">{s.name}</p>
                <p className="text-xs text-ink-400 mt-1 line-clamp-2">{s.description}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.available ? 'bg-primary-500' : 'bg-ink-300'}`} />
                  <span className="text-[10px] text-ink-400">{s.available ? 'Available' : 'Unavailable'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

export function ServiceDetail({ serviceId, onBack }: { serviceId: string; onBack: () => void }) {
  const [service, setService] = useState<Service | null>(null);

  useEffect(() => {
    supabase.from('services').select('*').eq('id', serviceId).maybeSingle().then(({ data }) => {
      setService(data as Service | null);
    });
  }, [serviceId]);

  if (!service) {
    return (
      <Screen>
        <ScreenHeader title="Service" onBack={onBack} />
        <div className="p-8 text-center text-ink-400 text-sm">Loading…</div>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={service.name} subtitle={service.category} onBack={onBack} />
      <div className="px-5 py-6">
        <div className="w-16 h-16 rounded-3xl bg-primary-50 flex items-center justify-center mb-4">
          <ServiceIcon name={service.icon} className="w-8 h-8 text-primary-600" />
        </div>
        <p className="text-ink-600 text-sm leading-relaxed">{service.description}</p>

        <div className="mt-6 bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-ink-900 mb-3">What you can do</h3>
          <div className="space-y-3">
            {['View live status and updates', 'Submit requests and track progress', 'Pay bills and get receipts', 'Get AI-powered recommendations'].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <ChevronRight className="w-3.5 h-3.5 text-primary-600" />
                </div>
                <p className="text-sm text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl p-5">
          <h3 className="font-bold text-ink-900 mb-1">Quick actions</h3>
          <p className="text-xs text-ink-500 mb-4">Jump to related features</p>
          <div className="flex flex-wrap gap-2">
            {['File Complaint', 'Pay Bill', 'View Map'].map((a) => (
              <span key={a} className="px-3 py-1.5 bg-white rounded-full text-xs font-medium text-ink-700 shadow-sm">
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}
