import { useEffect, useState } from 'react';
import {
  Siren, Shield, HeartPulse, Flame, CloudRain, MapPin, Phone,
  CheckCircle2, X, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { timeAgo } from '@/lib/utils';
import type { EmergencyRequest, EmergencyType } from '@/lib/types';

const types: { value: EmergencyType; label: string; icon: typeof Siren; color: string; bg: string; phone: string }[] = [
  { value: 'police', label: 'Police', icon: Shield, color: 'text-secondary-600', bg: 'bg-secondary-600', phone: '100' },
  { value: 'ambulance', label: 'Ambulance', icon: HeartPulse, color: 'text-error-500', bg: 'bg-error-500', phone: '108' },
  { value: 'fire', label: 'Fire', icon: Flame, color: 'text-accent-500', bg: 'bg-accent-500', phone: '101' },
  { value: 'disaster', label: 'Disaster', icon: CloudRain, color: 'text-primary-600', bg: 'bg-primary-600', phone: '1077' },
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

export function Emergency({ onBack }: { onBack: () => void }) {
  const { session } = useAuth();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmType, setConfirmType] = useState<EmergencyType | null>(null);
  const [active, setActive] = useState<EmergencyRequest | null>(null);
  const [countdown, setCountdown] = useState(3);

  // Operator Call Simulator States
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState<EmergencyType | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callLogs, setCallLogs] = useState<{ sender: 'operator' | 'user'; text: string }[]>([]);
  const [callInput, setCallInput] = useState('');
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');

  const load = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('emergency_requests')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [session]);

  useEffect(() => {
    if (confirmType === null) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          sendSOS(confirmType);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmType]);

  useEffect(() => {
    let interval: any;
    if (callActive && callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive, callStatus]);

  const speak = (msg: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startOperatorCall = (type: EmergencyType, locationName: string) => {
    setCallType(type);
    setCallStatus('ringing');
    setCallDuration(0);
    setCallActive(true);
    setCallLogs([]);
    speak("Dialing Emergency Services Dispatch...");

    setTimeout(() => {
      setCallStatus('connected');
      const welcomeMsg = `Emergency operator connected. We have received your ${type.toUpperCase()} alert from ${locationName.split('(')[0].trim()}. Please state your emergency.`;
      setCallLogs([{ sender: 'operator', text: welcomeMsg }]);
      speak(welcomeMsg);
    }, 2000);
  };

  const handleOperatorRespond = async (inputText: string) => {
    if (!inputText.trim() || !active) return;
    setCallLogs((prev) => [...prev, { sender: 'user', text: inputText.trim() }]);
    setCallInput('');

    const newNotes = `Emergency update: "${inputText.trim()}" (operator dispatch logged)`;
    await supabase.from('emergency_requests').update({ notes: newNotes }).eq('id', active.id);

    let reply = "";
    const txt = inputText.toLowerCase();

    if (active.type === 'police') {
      if (txt.includes('break-in') || txt.includes('robbery') || txt.includes('theft')) {
        reply = "Active break-in logged. Patrol unit Delta-4 is dispatched. ETA 4 minutes. Secure your entryways immediately.";
      } else if (txt.includes('accident') || txt.includes('crash')) {
        reply = "Accident logged. Patrol and traffic control are en route. Keep the roadway clear.";
      } else {
        reply = "Police dispatch vehicle has been routed to your GPS coordinates. Please remain secure.";
      }
    } else if (active.type === 'ambulance') {
      if (txt.includes('chest') || txt.includes('heart') || txt.includes('pain')) {
        reply = "Suspected cardiac event logged. Ambulance Alpha-9 dispatched. Keep patient calm and loosen tight clothing.";
      } else if (txt.includes('breath') || txt.includes('chok')) {
        reply = "Airway emergency logged. Paramedics routed. Help patient sit forward and keep airways clear.";
      } else {
        reply = "Ambulance dispatched. Medical team will locate you using your GPS beacon.";
      }
    } else if (active.type === 'fire') {
      if (txt.includes('gas') || txt.includes('leak')) {
        reply = "Gas leak threat logged. Fire engine Echo-3 dispatched. Turn off valves, evacuate building, and do not use electrical switches.";
      } else {
        reply = "Structural fire logged. Fire rescue dispatched. Evacuate immediately and assemble at safe zone.";
      }
    } else {
      if (txt.includes('flood') || txt.includes('water')) {
        reply = "Flood alert logged. Disaster response dispatch en route. Evacuate to higher elevation immediately.";
      } else {
        reply = "Disaster rescue log active. Team dispatched. Seek structural shelter immediately.";
      }
    }

    setTimeout(() => {
      setCallLogs((prev) => [...prev, { sender: 'operator', text: reply }]);
      speak(reply);
    }, 800);
  };

  const endCall = () => {
    window.speechSynthesis.cancel();
    setCallActive(false);
    setCallStatus('ended');
  };

  const sendSOS = async (type: EmergencyType) => {
    if (!session?.user) return;
    
    let locationText = 'Lat: 20.2184, Lng: 85.7331 (Bhubaneswar, Odisha)';
    try {
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        // Find nearest database map point to describe relative location
        const { data: points } = await supabase.from('map_points').select('name, lat, lng');
        let nearestLandmark = '';
        let minDistance = Infinity;
        
        if (points && points.length > 0) {
          for (const p of points) {
            const dist = getDistance(lat, lng, Number(p.lat), Number(p.lng));
            if (dist < minDistance) {
              minDistance = dist;
              nearestLandmark = p.name;
            }
          }
        }

        if (nearestLandmark && minDistance < 5) {
          locationText = `Near ${nearestLandmark} (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}, Bhubaneswar)`;
        } else {
          locationText = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} (Bhubaneswar, Odisha)`;
        }
      }
    } catch (e) {
      console.warn("Could not retrieve GPS coordinates, using fallback:", e);
    }

    const { data } = await supabase.from('emergency_requests').insert({
      user_id: session.user.id,
      type,
      location_text: locationText,
      notes: 'SOS dispatched from citizen app',
    }).select('*').single();

    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: 'Emergency SOS sent',
      message: `Your ${type} emergency request has been dispatched. Stay safe — help is on the way.`,
      type: 'emergency',
    });

    setConfirmType(null);
    if (data) {
      setActive(data as EmergencyRequest);
      startOperatorCall(type, locationText);
    }
    load();
  };

  const cancelSOS = () => {
    setConfirmType(null);
  };

  const resolveActive = async () => {
    if (!active) return;
    await supabase.from('emergency_requests').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', active.id);
    setActive(null);
    load();
  };

  return (
    <Screen>
      <ScreenHeader title="Emergency SOS" subtitle="One tap to dispatch help" onBack={onBack} />

      {/* SOS button */}
      <div className="px-4 py-6">
        <div className="bg-gradient-to-br from-error-500 to-error-600 rounded-3xl p-6 text-white text-center shadow-xl shadow-error-500/20">
          <p className="text-error-100 text-sm font-medium">Press and hold to send SOS</p>
          <p className="text-white/70 text-xs mt-1">Your location will be shared with emergency services</p>
        </div>

        {/* Emergency type buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {types.map(({ value, label, icon: Icon, color, bg }) => (
            <button
              key={value}
              onClick={() => setConfirmType(value)}
              className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-ink-900">{label}</p>
                <p className="text-xs text-ink-400 mt-0.5">Tap to dispatch</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active emergency banner */}
      {active && (
        <div className="px-4 pb-4">
          <div className="bg-error-500/10 border-2 border-error-500/30 rounded-2xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 text-error-600">
              <div className="relative w-3 h-3">
                <div className="absolute inset-0 rounded-full bg-error-500 pulse-ring" />
                <div className="absolute inset-0 rounded-full bg-error-500" />
              </div>
              <p className="font-bold text-sm">SOS ACTIVE · {active.type.toUpperCase()}</p>
            </div>
            <p className="text-xs text-ink-500 mt-2">Help has been dispatched to your location. Stay where you are.</p>
            <div className="flex gap-2 mt-3">
              <Button variant="danger" size="sm" onClick={resolveActive} className="flex-1">
                <CheckCircle2 className="w-4 h-4" /> Mark Resolved
              </Button>
              <a href="tel:100" className="px-4 py-2.5 bg-ink-100 rounded-xl text-ink-600 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Recent emergencies */}
      <div className="px-4">
        <h2 className="font-bold text-ink-900 mb-3">Recent SOS</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="bg-white rounded-2xl h-16 skeleton" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-ink-400">
            No emergency requests. Stay safe!
          </div>
        ) : (
          <div className="space-y-2.5">
            {requests.map((r) => {
              const cfg = types.find((t) => t.value === r.type)!;
              return (
                <div key={r.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <cfg.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-800 capitalize">{r.type}</p>
                    <p className="text-xs text-ink-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {r.location_text} · {timeAgo(r.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${
                    r.status === 'active' ? 'bg-error-500/10 text-error-600' :
                    r.status === 'dispatched' ? 'bg-accent-500/10 text-accent-600' :
                    'bg-primary-100 text-primary-700'
                  }`}>
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <Modal open={confirmType !== null} onClose={cancelSOS} title="Confirm SOS">
        {confirmType && (
          <div className="text-center space-y-5">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-error-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-error-500 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-ink-900">Send {confirmType} SOS?</p>
              <p className="text-sm text-ink-500 mt-1">Your location and details will be shared with emergency services immediately.</p>
            </div>
            <div className="bg-error-500/10 rounded-xl p-3">
              <p className="text-error-600 font-bold text-2xl">{countdown}</p>
              <p className="text-xs text-ink-500">Sending in {countdown} second{countdown !== 1 ? 's' : ''}…</p>
            </div>
            <Button variant="outline" size="lg" className="w-full" onClick={cancelSOS}>
              <X className="w-4 h-4" /> Cancel
            </Button>
          </div>
        )}
      </Modal>

      {/* Call Simulator Overlay */}
      {callActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl p-5 flex flex-col h-[75vh] justify-between shadow-2xl animate-scale-in text-white">
            {/* Call Header */}
            <div className="text-center space-y-2">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <div className="absolute inset-0 rounded-full bg-error-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-error-500 flex items-center justify-center">
                  <Phone className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="font-extrabold text-white text-lg">EMERGENCY DISPATCH</h3>
              <p className="text-xs text-error-400 font-bold uppercase tracking-widest">
                {callStatus === 'ringing' ? 'Ringing...' : `Connected (${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, '0')})`}
              </p>
              <p className="text-xs text-ink-300 font-medium px-4 truncate">
                {active?.location_text || 'Bhubaneswar, Odisha'}
              </p>
            </div>

            {/* Conversation Log */}
            <div className="flex-1 overflow-y-auto my-3 space-y-3 px-2 py-3 bg-black/20 rounded-2xl border border-white/5">
              {callLogs.map((log, i) => (
                <div key={i} className={`flex ${log.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                    log.sender === 'user' 
                      ? 'bg-primary-600 text-white rounded-tr-sm' 
                      : 'bg-slate-800 text-slate-200 border border-white/5 rounded-tl-sm'
                  }`}>
                    {log.text}
                  </div>
                </div>
              ))}
              {callStatus === 'ringing' && (
                <p className="text-center text-xs text-ink-500 animate-pulse mt-12">Establishing secure line...</p>
              )}
            </div>

            {/* Response Options */}
            <div className="space-y-3 shrink-0">
              {callStatus === 'connected' && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-ink-500 tracking-wider">QUICK RESPONSES</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {callType === 'police' && ['Active break-in', 'Assault/Threat', 'Traffic Accident', 'Send help now'].map(t => (
                      <button key={t} onClick={() => handleOperatorRespond(t)} className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] rounded-lg text-left truncate font-semibold border border-white/5 cursor-pointer">
                        {t}
                      </button>
                    ))}
                    {callType === 'ambulance' && ['Chest pain', 'Breathing difficulty', 'Accident casualty', 'Unconscious patient'].map(t => (
                      <button key={t} onClick={() => handleOperatorRespond(t)} className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] rounded-lg text-left truncate font-semibold border border-white/5 cursor-pointer">
                        {t}
                      </button>
                    ))}
                    {callType === 'fire' && ['Building fire', 'Electrical spark', 'LPG Gas leak', 'Vehicle fire'].map(t => (
                      <button key={t} onClick={() => handleOperatorRespond(t)} className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] rounded-lg text-left truncate font-semibold border border-white/5 cursor-pointer">
                        {t}
                      </button>
                    ))}
                    {callType === 'disaster' && ['Severe flooding', 'Live wire down', 'Building collapse', 'Road blocked'].map(t => (
                      <button key={t} onClick={() => handleOperatorRespond(t)} className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] rounded-lg text-left truncate font-semibold border border-white/5 cursor-pointer">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TextInput / End Call button row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={callStatus === 'connected' ? "Type emergency details..." : "Connecting..."}
                  disabled={callStatus !== 'connected'}
                  value={callInput}
                  onChange={(e) => setCallInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOperatorRespond(callInput)}
                  className="flex-1 px-3 py-2 text-xs bg-black/30 border border-white/10 text-white rounded-xl focus:outline-none focus:border-primary-500"
                />
                <button
                  disabled={callStatus !== 'connected' || !callInput.trim()}
                  onClick={() => { if (callInput.trim()) handleOperatorRespond(callInput); }}
                  className="px-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Send
                </button>
              </div>

              <Button variant="danger" size="sm" className="w-full flex items-center justify-center gap-2" onClick={endCall}>
                <X className="w-4 h-4" /> Disconnect Call
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
