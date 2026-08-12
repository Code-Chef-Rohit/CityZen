import { useEffect, useState } from 'react';
import { 
  Building, Bed, Activity, Phone, MapPin, Save, LogOut, CheckCircle2, Siren, Shield, Plus, Mail
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/Button';

export default function MerchantDashboard() {
  const { profile, session, signOut } = useAuth();
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  
  // Hospital Form & Onboarding States
  const [hospitalName, setHospitalName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [phoneText, setPhoneText] = useState('');
  const [bedsTotal, setBedsTotal] = useState(100);
  const [bedsAvailable, setBedsAvailable] = useState(45);
  const [specialties, setSpecialties] = useState('');
  const [latitudeText, setLatitudeText] = useState('20.2223');
  const [longitudeText, setLongitudeText] = useState('85.7335');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // SOS requests routed to hospital
  const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const loadHospitals = async () => {
    if (!profile) return;
    // Fetch only the hospital belonging to this specific logged-in merchant
    const { data } = await supabase
      .from('map_points')
      .select('*')
      .eq('category', 'hospital')
      .eq('owner_id', profile.id);
    
    setHospitals(data ?? []);
    if (data && data.length > 0) {
      handleSelectHospital(data[0]);
    } else {
      setSelectedHospital(null);
    }
  };

  const handleSelectHospital = (hospital: any) => {
    setSelectedHospital(hospital);
    setPhoneText(hospital.phone || '');
    
    // Parse metadata
    let cleanAddress = hospital.address || '';
    let bTotal = 100;
    let bAvail = 45;
    let specs = 'Emergency, Cardiology, ICU, Pediatrics';

    if (hospital.address && hospital.address.includes('|||')) {
      try {
        const parts = hospital.address.split('|||');
        cleanAddress = parts[0].trim();
        const parsed = JSON.parse(parts[1]);
        if (parsed.bedsTotal) bTotal = Number(parsed.bedsTotal);
        if (parsed.bedsAvailable) bAvail = Number(parsed.bedsAvailable);
        if (parsed.specialties) specs = parsed.specialties;
      } catch (e) {}
    }

    setHospitalName(hospital.name || '');
    setAddressText(cleanAddress);
    setBedsTotal(bTotal);
    setBedsAvailable(bAvail);
    setSpecialties(specs);
    setLatitudeText(String(hospital.lat || '20.2223'));
    setLongitudeText(String(hospital.lng || '85.7335'));
  };

  const handleSaveHospitalDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospital) return;
    setSaving(true);
    setSuccessMsg('');

    const meta = JSON.stringify({ bedsTotal, bedsAvailable, specialties });
    const fullAddress = `${addressText.trim()} ||| ${meta}`;

    const { error } = await supabase
      .from('map_points')
      .update({
        name: hospitalName.trim(),
        address: fullAddress,
        phone: phoneText.trim(),
        lat: Number(latitudeText),
        lng: Number(longitudeText)
      })
      .eq('id', selectedHospital.id);

    setSaving(false);
    if (error) {
      alert('Failed to update hospital: ' + error.message);
    } else {
      setSuccessMsg('Hospital telemetry updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadHospitals();
    }
  };

  const loadEmergencyAlerts = async () => {
    const { data } = await supabase
      .from('emergency_requests')
      .select('*')
      .eq('type', 'ambulance')
      .order('created_at', { ascending: false })
      .limit(10);
    setEmergencyAlerts(data ?? []);
    setLoadingAlerts(false);
  };

  useEffect(() => {
    loadHospitals();
    loadEmergencyAlerts();
  }, [profile]);

  const handleQuickBedUpdate = async (newAvailable: number) => {
    if (!selectedHospital) return;
    if (newAvailable < 0 || newAvailable > bedsTotal) return;

    setBedsAvailable(newAvailable);
    const meta = JSON.stringify({ bedsTotal, bedsAvailable: newAvailable, specialties });
    const fullAddress = `${addressText.trim()} ||| ${meta}`;

    await supabase
      .from('map_points')
      .update({ address: fullAddress })
      .eq('id', selectedHospital.id);
  };

  const handleRegisterHospital = async () => {
    if (!profile) return;
    if (!hospitalName.trim()) { alert('Please enter the hospital name.'); return; }
    if (!addressText.trim()) { alert('Please enter address.'); return; }

    setSaving(true);
    setSuccessMsg('');

    const meta = JSON.stringify({ bedsTotal, bedsAvailable, specialties });
    const fullAddress = `${addressText.trim()} ||| ${meta}`;

    const { error } = await supabase.from('map_points').insert({
      name: hospitalName.trim(),
      category: 'hospital',
      lat: Number(latitudeText),
      lng: Number(longitudeText),
      address: fullAddress,
      phone: phoneText.trim(),
      open_24h: true,
      owner_id: profile.id // Link to this merchant!
    });

    setSaving(false);
    if (error) {
      alert('Failed to register hospital: ' + error.message);
    } else {
      setSuccessMsg('Hospital profile registered successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadHospitals();
    }
  };

  const handleUpdateAlertStatus = async (alertId: string, newStatus: string) => {
    await supabase
      .from('emergency_requests')
      .update({ status: newStatus })
      .eq('id', alertId);
    loadEmergencyAlerts();
  };

  const merchantEmail = session?.user?.email || profile?.email || 'merchant@cityzen.gov';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-emerald-950/40 backdrop-blur-md border-b border-emerald-500/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-emerald-300">City Zen Merchant Portal</h1>
            <p className="text-xs text-emerald-400/70">Hospital Service Provider Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-xs font-bold text-white">{profile?.full_name || 'Hospital Merchant'}</span>
            <span className="text-[10px] text-emerald-300/80 font-mono flex items-center justify-end gap-1">
              <Mail className="w-3 h-3 text-emerald-400" /> {merchantEmail}
            </span>
          </div>

          <div className="bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
            Active Role: Merchant
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 rounded-xl text-xs text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Hospital Facility details form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md">
            {selectedHospital ? (
              <div>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="font-bold text-base text-emerald-300 flex items-center gap-2">
                    <Building className="w-5 h-5 text-emerald-400" /> Accommodation & Facility Management
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                    <p className="text-xs text-slate-400 font-bold">LINKED HOSPITAL NAME</p>
                    <p className="text-lg font-black text-white mt-1">{selectedHospital.name}</p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-500" /> Location Coordinates: {selectedHospital.lat}, {selectedHospital.lng}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Total Bed Capacity</label>
                      <input
                        type="number"
                        value={bedsTotal}
                        onChange={(e) => setBedsTotal(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Available Beds</label>
                      <input
                        type="number"
                        value={bedsAvailable}
                        onChange={(e) => setBedsAvailable(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Contact Hotline</label>
                      <input
                        type="text"
                        value={phoneText}
                        onChange={(e) => setPhoneText(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Address / Street</label>
                      <input
                        type="text"
                        value={addressText}
                        onChange={(e) => setAddressText(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Specialties & Facilities (Comma Separated)</label>
                    <textarea
                      rows={3}
                      value={specialties}
                      onChange={(e) => setSpecialties(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 resize-none"
                      placeholder="e.g. Cardiology, Intensive Care, Neonatology, Emergency Medicine"
                    />
                  </div>

                  {successMsg && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <Button onClick={handleSaveHospitalDetails} loading={saving} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Save className="w-4 h-4 mr-2" /> Save Facility Details
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-5">
                  <h2 className="font-bold text-base text-emerald-300 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-400" /> Register Your Hospital Facility Profile
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Please enter your facility details. Once registered, citizens will see this profile on their Smart Map and track real-time bed capacity!</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Hospital Name</label>
                    <input
                      type="text"
                      placeholder="e.g. AIIMS Patrapada Emergency Centre"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Total Bed Capacity</label>
                      <input
                        type="number"
                        value={bedsTotal}
                        onChange={(e) => setBedsTotal(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Available Vacant Beds</label>
                      <input
                        type="number"
                        value={bedsAvailable}
                        onChange={(e) => setBedsAvailable(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Latitude Coordinate</label>
                      <input
                        type="text"
                        placeholder="e.g. 20.2223"
                        value={latitudeText}
                        onChange={(e) => setLatitudeText(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Longitude Coordinate</label>
                      <input
                        type="text"
                        placeholder="e.g. 85.7335"
                        value={longitudeText}
                        onChange={(e) => setLongitudeText(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Contact Hotline Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 0674-247-6600"
                        value={phoneText}
                        onChange={(e) => setPhoneText(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Address Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Sijua, Patrapada, Bhubaneswar"
                        value={addressText}
                        onChange={(e) => setAddressText(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Facilities & Specialties (Comma Separated)</label>
                    <textarea
                      rows={3}
                      value={specialties}
                      onChange={(e) => setSpecialties(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500 resize-none text-white"
                      placeholder="e.g. Intensive Care, Cardiology, Trauma Centre, Pharmacy 24x7"
                    />
                  </div>

                  {successMsg && (
                    <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <Button onClick={handleRegisterHospital} loading={saving} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Register Hospital Facility
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Emergency Alert queue */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md flex flex-col h-full justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-base text-red-400 flex items-center gap-2">
                  <Siren className="w-5 h-5 text-red-500 animate-pulse" /> Active Dispatches
                </h2>
                <span className="text-[10px] bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-full text-red-400 font-bold uppercase">Live</span>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                {loadingAlerts ? (
                  [1, 2].map(i => <div key={i} className="bg-slate-950/40 h-20 rounded-2xl skeleton" />)
                ) : emergencyAlerts.length === 0 ? (
                  <div className="bg-slate-950/40 rounded-2xl p-6 text-center text-xs text-slate-500 border border-white/5">
                    No active dispatches. Facility status: Clear.
                  </div>
                ) : (
                  emergencyAlerts.map(alert => (
                    <div key={alert.id} className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase">
                          {alert.type}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="text-xs space-y-1">
                        <p><strong className="text-white">Location:</strong> {alert.location_text}</p>
                        <p><strong className="text-white">Log:</strong> {alert.notes || 'No description provided'}</p>
                      </div>

                      <div className="flex gap-2 pt-1.5 border-t border-white/5">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleUpdateAlertStatus(alert.id, 'dispatched')}
                            className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Dispatch Vehicle
                          </button>
                        )}
                        {alert.status === 'dispatched' && (
                          <button
                            onClick={() => handleUpdateAlertStatus(alert.id, 'resolved')}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Resolve Alert
                          </button>
                        )}
                        {alert.status === 'resolved' && (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved & Cleared
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/5 mt-4">
              <p className="text-xs text-slate-400">MUNICIPAL STATUS REPORT</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-center text-xs">
                <div className="bg-slate-900 p-2 rounded-xl border border-white/5">
                  <p className="font-extrabold text-white">{bedsAvailable}</p>
                  <p className="text-[9px] text-slate-400">Available Beds</p>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-white/5">
                  <p className="font-extrabold text-red-400">{emergencyAlerts.filter(a => a.status !== 'resolved').length}</p>
                  <p className="text-[9px] text-slate-400">Active SOS Alerts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
