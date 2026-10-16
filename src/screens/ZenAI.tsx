import { useEffect, useRef, useState } from 'react';
import { 
  Sparkles, Send, Mic, MapPin, Building2, Droplets, Zap, X, FileText, RotateCcw, 
  Siren, Navigation, Compass, ShieldAlert, PhoneCall, CheckCircle2, ChevronRight, Cpu 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Screen, ScreenHeader } from '@/components/Screen';
import { cn } from '@/lib/utils';
import { processNeuralResponse } from '@/lib/zenAiNeuralNetwork';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  cards?: { 
    icon: any; 
    title: string; 
    subtitle: string; 
    action?: string; 
    actionClick?: () => void;
  }[];
}

const QUICK_SUGGESTIONS = [
  { label: '🚑 Hospitals', query: 'Find nearest hospital' },
  { label: '⚡ Pay Bills', query: 'Show pending utility bills' },
  { label: '🚨 SOS Emergency', query: 'Police emergency dispatch' },
  { label: '🌬️ Air Quality', query: 'Check air quality and AQI' },
  { label: '📜 DigiLocker', query: 'Link birth certificate and Aadhaar' },
  { label: '💧 Water Leakage', query: 'Report water leakage' },
  { label: '🚧 Pothole Repair', query: 'Report pothole issue' },
  { label: '💡 Streetlight', query: 'Report streetlight failure' },
];

const DEFAULT_WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'ai',
  text: "Hi! I'm Zen, your smart municipal assistant. Ask me anything — locate 24/7 hospitals, file civic complaints, pay utility bills, check live air quality, or trigger emergency dispatches.",
};

const SESSION_STORAGE_KEY = 'cityzen_zen_ai_messages';

let inMemoryZenMessages: Message[] = (() => {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [DEFAULT_WELCOME_MSG];
})();

export function ZenAI({ onBack, onNavigate }: { onBack: () => void; onNavigate?: (screenObj: any) => void }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    return inMemoryZenMessages.length > 0 ? inMemoryZenMessages : [DEFAULT_WELCOME_MSG];
  });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inMemoryZenMessages = messages;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  const handleClearChat = () => {
    const fresh: Message = {
      id: 'welcome-' + Date.now(),
      role: 'ai',
      text: "Hi! I'm Zen, your smart municipal assistant. Ask me anything — locate 24/7 hospitals, file civic complaints, pay utility bills, check live air quality, or trigger emergency dispatches.",
    };
    inMemoryZenMessages = [fresh];
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
    setMessages([fresh]);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

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

      let liveWeatherInfo = { temp: 29, aqi: 68, humidity: 68, pm25: 21.4, pm10: 46.8 };
      try {
        const [wRes, aRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=20.2961&longitude=85.8245&current=temperature_2m,relative_humidity_2m`).then(r => r.json()),
          fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=20.2961&longitude=85.8245&current=us_aqi,pm10,pm2_5`).then(r => r.json())
        ]);
        if (wRes?.current) {
          liveWeatherInfo.temp = Math.round(wRes.current.temperature_2m);
          liveWeatherInfo.humidity = Math.round(wRes.current.relative_humidity_2m);
        }
        if (aRes?.current) {
          liveWeatherInfo.aqi = Math.round(aRes.current.us_aqi ?? 68);
          liveWeatherInfo.pm25 = Number((aRes.current.pm2_5 ?? 21.4).toFixed(1));
          liveWeatherInfo.pm10 = Number((aRes.current.pm10 ?? 46.8).toFixed(1));
        }
      } catch (e) {}

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
        availableServices: servicesData,
        liveWeather: liveWeatherInfo
      };

      await new Promise(resolve => setTimeout(resolve, 400));

      const neuralRes = processNeuralResponse(text, cityContext, onNavigate);
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: neuralRes.text,
        cards: neuralRes.cards
      }]);

    } catch (err: any) {
      console.error(err);
      const neuralRes = processNeuralResponse(text, {
        userProfile: null,
        outstandingBills: [],
        filedComplaints: [],
        environmentalReadings: [],
        nearbyLocations: [],
        availableServices: []
      }, onNavigate);
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: neuralRes.text,
        cards: neuralRes.cards
      }]);
    } finally {
      setThinking(false);
    }
  };

  const toggleVoice = () => {
    if (listening) {
      setListening(false);
      return;
    }

    setListening(true);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setInput(transcript);
            send(transcript);
          }
          setListening(false);
        };

        recognition.onerror = () => { setListening(false); };
        recognition.onend = () => { setListening(false); };
        recognition.start();
        return;
      } catch (e) {
        console.warn("Speech recognition error:", e);
      }
    }

    // Fallback simulation if speech recognition is not supported in browser
    setTimeout(() => {
      setListening(false);
      const fallbackQuery = 'Find nearest hospital';
      setInput(fallbackQuery);
      send(fallbackQuery);
    }, 2000);
  };

  return (
    <Screen noBottomPad className="flex flex-col h-[100dvh] md:h-[82vh] relative overflow-hidden bg-ink-50 dark:bg-slate-950">
      <ScreenHeader
        title="Zen AI"
        subtitle="Neural Intent Engine v2.5 (Softmax MLP)"
        onBack={onBack}
        right={
          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <button
                onClick={handleClearChat}
                className="text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
                title="Clear chat history"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            )}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
          </div>
        }
      />

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 px-3 sm:px-4 py-4 space-y-4 overflow-y-auto pb-32">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2.5', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm',
              msg.role === 'ai' ? 'bg-gradient-to-br from-primary-500 to-secondary-600' : 'bg-ink-200 dark:bg-slate-800',
            )}>
              {msg.role === 'ai' ? <Sparkles className="w-4 h-4 text-white" /> : <span className="text-xs font-bold text-ink-600 dark:text-slate-300">You</span>}
            </div>

            <div className={cn('max-w-[85%] sm:max-w-[78%]', msg.role === 'user' && 'flex flex-col items-end')}>
              <div className={cn(
                'px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                msg.role === 'ai' 
                  ? 'bg-white dark:bg-slate-900 text-ink-800 dark:text-slate-100 rounded-tl-sm border border-slate-100 dark:border-slate-800' 
                  : 'bg-primary-600 text-white rounded-tr-sm font-medium',
              )}>
                {msg.text}
              </div>

              {msg.cards && (
                <div className="mt-2.5 space-y-2 w-full">
                  {msg.cards.map((card, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center shrink-0 border border-primary-500/20">
                        <card.icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink-900 dark:text-white text-xs sm:text-sm truncate">{card.title}</p>
                        <p className="text-[11px] text-ink-400 dark:text-slate-400 truncate mt-0.5">{card.subtitle}</p>
                      </div>
                      {card.action && (
                        <button
                          onClick={() => card.actionClick && card.actionClick()}
                          className="text-xs font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-3 py-1.5 rounded-xl cursor-pointer transition-colors border border-primary-500/20 shrink-0"
                        >
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
                <span className="text-xs text-slate-400 font-medium ml-2">Zen AI is processing...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Suggestion Chips Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => send(s.query)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/50 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-slate-700/60 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap transition-all active:scale-95 cursor-pointer shrink-0"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Docked Input bar */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-3 safe-area-inset-bottom shrink-0 shadow-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoice}
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm',
              listening 
                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/20' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
            )}
            title="Speech Voice Search"
          >
            <Mic className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            placeholder="Ask Zen anything (e.g. nearest hospital)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 transition-all"
          />
          
          <button
            onClick={() => send(input)}
            disabled={!input.trim()}
            className="w-11 h-11 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-all cursor-pointer shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        {listening && (
          <p className="text-center text-[10px] text-red-500 font-bold mt-1.5 animate-pulse">
            🎙️ Listening to your voice... Speak now!
          </p>
        )}
      </div>
    </Screen>
  );
}
