import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Mic, MapPin, Building2, Droplets, Zap, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Screen, ScreenHeader } from '@/components/Screen';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  cards?: { icon: typeof MapPin; title: string; subtitle: string; action?: string }[];
}

const suggestions = [
  'Find nearest hospital',
  'Report a water leakage',
  'Pay my electricity bill',
  'What\'s the AQI today?',
  'Track my complaints',
];

export function ZenAI({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: "Hi! I'm Zen, your city assistant. Ask me anything — find services, file complaints, pay bills, or get city updates.",
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const generateResponse = (query: string): Message => {
    const q = query.toLowerCase();
    if (q.includes('hospital') || q.includes('doctor') || q.includes('clinic')) {
      return {
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'I found 2 hospitals near you. City General Hospital is the closest at 1.2 km and is open 24x7.',
        cards: [
          { icon: Building2, title: 'City General Hospital', subtitle: '1.2 km · Open 24x7 · 080-2200-1000', action: 'Get Directions' },
          { icon: Building2, title: "Sunrise Children's Clinic", subtitle: '2.8 km · Open till 6 PM', action: 'Get Directions' },
        ],
      };
    }
    if (q.includes('water') && (q.includes('leak') || q.includes('report') || q.includes('complaint'))) {
      return {
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'I can help you file a water complaint. Please provide the location of the leakage, and I\'ll submit it to the Water Board.',
        cards: [{ icon: Droplets, title: 'File Water Complaint', subtitle: 'Water Board · Auto-assigned', action: 'Start' }],
      };
    }
    if (q.includes('bill') || q.includes('pay')) {
      return {
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'You have 2 pending bills. Your electricity bill of ₹1,450 is due on Aug 31. Would you like to pay now?',
        cards: [
          { icon: Zap, title: 'Electricity Bill', subtitle: '₹1,450 · Due Aug 31', action: 'Pay Now' },
          { icon: Droplets, title: 'Water Bill', subtitle: '₹320 · Due Sep 5', action: 'Pay Now' },
        ],
      };
    }
    if (q.includes('aqi') || q.includes('air') || q.includes('quality')) {
      return {
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'The current Air Quality Index is 78 (Satisfactory). PM2.5 is at 35 µg/m³. It\'s a good day for outdoor activities!',
      };
    }
    if (q.includes('complaint') || q.includes('track')) {
      return {
        id: crypto.randomUUID(),
        role: 'ai',
        text: 'You have 3 active complaints. The most recent — "Broken water pipe" — is currently in progress and assigned to the Water Board.',
        cards: [{ icon: MapPin, title: 'View All Complaints', subtitle: '3 active · 1 in progress', action: 'Open' }],
      };
    }
    return {
      id: crypto.randomUUID(),
      role: 'ai',
      text: "I can help with finding services, filing complaints, paying bills, checking air quality, tracking complaints, and emergency services. Try asking 'Find nearest hospital' or 'Pay my bill'.",
    };
  };

  const generateLocalResponse = (query: string, cityContext: any): { text: string; cards?: any[] } => {
    const q = query.toLowerCase().trim();
    const name = cityContext.userProfile?.name || 'Citizen';
    const ward = cityContext.userProfile?.ward ?? 12;

    if (q.includes('hi') || q.includes('hello') || q.includes('hey') || q.includes('yo') || q.includes('greetings') || q.includes('morning') || q.includes('afternoon') || q.includes('evening')) {
      let reply = `Hello ${name.split(' ')[0]}! I'm Zen, your smart local helper. I see you are logged in from Ward ${ward}. `;
      const unpaidBills = cityContext.outstandingBills;
      if (unpaidBills.length > 0) {
        reply += `You currently have ${unpaidBills.length} unpaid utility bills (Electricity: ₹1,450.00, Water: ₹280.50). `;
      } else {
        reply += `You have no pending bills. `;
      }
      reply += `How can I help you today?`;
      return { text: reply };
    }

    if (q.includes('profile') || q.includes('who am i') || q.includes('my name') || q.includes('account') || q.includes('identity') || q.includes('ward') || q.includes('word')) {
      const language = cityContext.userProfile?.language?.toUpperCase() || 'EN';
      const phone = cityContext.userProfile?.phone || 'Not registered';
      return {
        text: `Here is your registered citizen profile details:\n• Name: ${name}\n• Phone: ${phone}\n• Language: ${language}\n• Location: Ward ${ward}\n\nYou can edit these parameters anytime in your Profile tab!`
      };
    }

    if (q.includes('hospital') || q.includes('doctor') || q.includes('clinic') || q.includes('medical') || q.includes('health') || q.includes('emergency') || q.includes('ambulance') || q.includes('siren') || q.includes('sos')) {
      const hospitals = cityContext.nearbyLocations.filter((p: any) => p.category === 'hospital');
      if (hospitals.length > 0) {
        return {
          text: `I found medical facilities in your area. ${hospitals[0].name} is the closest. Here are the directions cards:`,
          cards: hospitals.map((h: any) => ({
            icon: Building2,
            title: h.name,
            subtitle: `${h.address || 'Bhubaneswar'} · ${h.phone || '0674-247-6600'}`,
            action: 'Get Directions'
          }))
        };
      }
      return {
        text: `I found medical facilities in your city: AIIMS Hospital Bhubaneswar (Sijua, Patrapada) is closest. I've rendered directions cards for you below:`,
        cards: [
          { icon: Building2, title: 'AIIMS Hospital Bhubaneswar', subtitle: 'Sijua, Patrapada · Open 24/7 · 0674-247-6600', action: 'Get Directions' },
          { icon: Building2, title: 'AMRI Hospital', subtitle: 'Khandagiri Chowk · Open 24/7 · 0674-666-6600', action: 'Get Directions' }
        ]
      };
    }

    if (q.includes('bill') || q.includes('pay') || q.includes('invoice') || q.includes('money') || q.includes('electricity') || q.includes('water') || q.includes('due') || q.includes('tax')) {
      const unpaidBills = cityContext.outstandingBills;
      if (unpaidBills.length > 0) {
        return {
          text: `You have ${unpaidBills.length} unpaid utility bills:`,
          cards: unpaidBills.map((b: any) => ({
            icon: b.type === 'electricity' ? Zap : Droplets,
            title: `${b.type.charAt(0).toUpperCase() + b.type.slice(1)} Bill`,
            subtitle: `₹${b.amount} · Status: ${b.status} · Due: ${b.due || 'Soon'}`,
            action: 'Pay Now'
          }))
        };
      }
      return { text: `You have no pending bills. All utility accounts are fully settled!` };
    }

    if (q.includes('complaint') || q.includes('track') || q.includes('status') || q.includes('report') || q.includes('broken') || q.includes('leak') || q.includes('garbage')) {
      const activeC = cityContext.filedComplaints;
      if (activeC.length > 0) {
        return {
          text: `You have ${activeC.length} active complaints filed. The most recent — "${activeC[0].title}" — is currently "${activeC[0].status}".`,
          cards: activeC.map((c: any, i: number) => ({
            icon: MapPin,
            title: c.title,
            subtitle: `Category: ${c.category} · Status: ${c.status}`,
            action: 'Open'
          }))
        };
      }
      return {
        text: `You have no active complaints filed. You can report issues like water leakage or broken streetlights from the Complaints tab.`,
        cards: [
          { icon: MapPin, title: 'Report New Issue', subtitle: 'Auto-assign to municipal supervisor', action: 'Start' }
        ]
      };
    }

    if (q.includes('aqi') || q.includes('air') || q.includes('quality') || q.includes('temp') || q.includes('weather') || q.includes('pollution') || q.includes('rain') || q.includes('sunny')) {
      return {
        text: `Here is the current live environmental status for Ward 12:\n• AQI: 78 (Satisfactory)\n• Temp: 29.5°C (Sunny)\n• Water Quality: 88%\n• Noise level: 62dB\n• Green Coverage: 34%\n• CO2 Level: 420ppm`
      };
    }

    if (q.includes('thanks') || q.includes('thank you') || q.includes('great') || q.includes('awesome') || q.includes('cool') || q.includes('ok') || q.includes('perfect')) {
      return {
        text: `You're welcome, ${name.split(' ')[0]}! Let me know if there's anything else I can help you with today.`
      };
    }

    return {
      text: `I'm Zen, your smart local assistant. I can help with:\n• Finding nearest hospitals ("nearest hospital")\n• Reviewing outstanding invoices ("show bills")\n• Tracking filed complaints ("complaint status")\n• Checking live environmental readings ("weather updates")\n\nHow can I help you today?`
    };
  };

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);

    let profileData = null;
    let billsData: any[] = [];
    let complaintsData: any[] = [];
    let envData: any[] = [];
    let mapPointsData: any[] = [];
    let servicesData: any[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const [profileRes, billsRes, complaintsRes, envRes, mapRes, servicesRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('bills').select('*').eq('user_id', user.id),
          supabase.from('complaints').select('*').eq('user_id', user.id),
          supabase.from('environmental_readings').select('*'),
          supabase.from('map_points').select('*').limit(5),
          supabase.from('services').select('*')
        ]);

        profileData = profileRes.data;
        billsData = billsRes.data ?? [];
        complaintsData = complaintsRes.data ?? [];
        envData = envRes.data ?? [];
        mapPointsData = mapRes.data ?? [];
        servicesData = servicesRes.data ?? [];
      }

      const cityContext = {
        userProfile: {
          name: profileData?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Citizen',
          phone: profileData?.phone || '',
          language: profileData?.language || 'en',
          ward: profileData?.ward
        },
        outstandingBills: billsData.map(b => ({ type: b.type, amount: b.amount, status: b.status, due: b.due_date })),
        filedComplaints: complaintsData.map(c => ({ title: c.title, status: c.status, category: c.category })),
        environmentalReadings: envData.map(e => ({ metric: e.metric, value: e.value, unit: e.unit })),
        nearbyLocations: mapPointsData.map(m => ({ name: m.name, category: m.category, address: m.address, phone: m.phone })),
        availableServices: servicesData
      };

      await new Promise(resolve => setTimeout(resolve, 600));

      const localResponse = generateLocalResponse(text, cityContext);
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: localResponse.text,
        cards: localResponse.cards
      }]);

    } catch (err: any) {
      console.error(err);
      const localResponse = generateLocalResponse(text, {
        userProfile: null,
        outstandingBills: [],
        filedComplaints: [],
        environmentalReadings: [],
        nearbyLocations: [],
        availableServices: []
      });
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: localResponse.text,
        cards: localResponse.cards
      }]);
    } finally {
      setThinking(false);
    }
  };

  const toggleVoice = () => {
    setListening(!listening);
    if (!listening) {
      setTimeout(() => {
        setListening(false);
        setInput('Find nearest hospital');
      }, 2000);
    }
  };

  return (
    <Screen noBottomPad className="flex flex-col h-[calc(100vh-2rem)] md:h-[80vh] relative justify-between overflow-hidden">
      <ScreenHeader
        title="Zen AI"
        subtitle="Your city assistant"
        onBack={onBack}
        right={
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        }
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2.5', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              msg.role === 'ai' ? 'bg-gradient-to-br from-primary-500 to-secondary-600' : 'bg-ink-200',
            )}>
              {msg.role === 'ai' ? <Sparkles className="w-4 h-4 text-white" /> : <span className="text-xs font-bold text-ink-600">You</span>}
            </div>
            <div className={cn('max-w-[78%]', msg.role === 'user' && 'flex flex-col items-end')}>
              <div className={cn(
                'px-4 py-2.5 rounded-2xl text-sm',
                msg.role === 'ai' ? 'bg-white text-ink-700 rounded-tl-sm shadow-sm' : 'bg-primary-600 text-white rounded-tr-sm',
              )}>
                {msg.text}
              </div>
              {msg.cards && (
                <div className="mt-2 space-y-2 w-full">
                  {msg.cards.map((card, i) => (
                    <div key={i} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                        <card.icon className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink-800 text-sm">{card.title}</p>
                        <p className="text-xs text-ink-400 truncate">{card.subtitle}</p>
                      </div>
                      {card.action && (
                        <button className="text-xs font-semibold text-primary-600 whitespace-nowrap">
                          {card.action}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-ink-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="px-3 py-2 bg-white rounded-full text-xs font-medium text-ink-600 shadow-sm whitespace-nowrap hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="bg-white border-t border-ink-100 p-3 safe-bottom">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoice}
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors',
              listening ? 'bg-error-500 text-white' : 'bg-ink-100 text-ink-500',
            )}
          >
            <Mic className="w-5 h-5" />
          </button>
          <input
            type="text"
            placeholder="Ask Zen anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            className="flex-1 px-4 py-3 bg-ink-50 border border-ink-200 rounded-full text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary-700 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {listening && (
          <p className="text-center text-xs text-error-500 mt-2 animate-fade-in">Listening… speak now</p>
        )}
      </div>
    </Screen>
  );
}
