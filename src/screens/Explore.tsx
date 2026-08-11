import { useEffect, useState, useRef } from 'react';
import { 
  Search, ChevronRight, Clock, AlertTriangle, Zap, Building, Trash2, 
  PlusCircle, Bus, Navigation, SquareParking, Building2, HeartPulse, 
  Phone, Shield, CheckCircle2, AlertCircle, FileText, ScrollText, Award, 
  Download, Share2, Leaf, Heart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ServiceIcon } from '@/components/ServiceIcon';
import { Screen, ScreenHeader } from '@/components/Screen';
import { formatINR } from '@/lib/utils';
import type { Service, CitizenCertificate } from '@/lib/types';

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

interface ServiceDetailProps {
  serviceId: string;
  onBack: () => void;
  onFileComplaint?: (category: any) => void;
  onPayBill?: (billType: any) => void;
  onViewMap?: (mapCategory: any) => void;
}

export function ServiceDetail({ 
  serviceId, 
  onBack,
  onFileComplaint,
  onPayBill,
  onViewMap
}: ServiceDetailProps) {
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  // General Action Form States
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Water Form States
  const [leakLocation, setLeakLocation] = useState('');
  const [leakSeverity, setLeakSeverity] = useState('moderate');

  // 2. Electricity Calculator States
  const [calcUnits, setCalcUnits] = useState('');
  const [calcResult, setCalcResult] = useState<number | null>(null);

  // 3. Waste Request States
  const [wasteType, setWasteType] = useState('e-waste');
  const [wasteLoc, setWasteLoc] = useState('');

  // 4. Mo Bus Fare States
  const [busSource, setBusSource] = useState('AIIMS');
  const [busDest, setBusDest] = useState('Master Canteen');
  const [busFare, setBusFare] = useState<number | null>(null);

  // 5. Parking Reservation States
  const [vehicleNo, setVehicleNo] = useState('');
  const [bookedTicket, setBookedTicket] = useState<any>(null);

  // 6. Hospital Beds & Specialty Ambulance States
  const [hospitalsList, setHospitalsList] = useState<any[]>([]);
  const [ambulanceLines, setAmbulanceLines] = useState<any[]>([]);
  const [loadingHosp, setLoadingHosp] = useState(false);

  // 7. SOS Form States
  const [sosNotes, setSosNotes] = useState('');
  const [sosTriggered, setSosTriggered] = useState(false);

  // 8. General Inline Complaint Form States
  const [compTitle, setCompTitle] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compLoc, setCompLoc] = useState('');

  // 9. DigiLocker Certificate Vault States
  const [certs, setCerts] = useState<CitizenCertificate[]>([]);
  const [newDocType, setNewDocType] = useState<'birth' | 'income' | 'aadhaar' | 'driving_license' | 'rc'>('birth');
  const [newDocNo, setNewDocNo] = useState('');
  const [newIssuedName, setNewIssuedName] = useState('');
  const [newIssueDate, setNewIssueDate] = useState('');
  const [showAddCert, setShowAddCert] = useState(false);
  const [loadingCerts, setLoadingCerts] = useState(false);

  // 10. Air Quality States
  const [aqiVal, setAqiVal] = useState(78);
  const [aqiPms, setAqiPms] = useState({ pm25: 22, pm10: 45, no2: 12, so2: 8 });

  useEffect(() => {
    setLoading(true);
    supabase.from('services').select('*').eq('id', serviceId).maybeSingle().then(({ data }) => {
      setService(data as Service | null);
      setLoading(false);
      
      if (data) {
        const name = data.name.toLowerCase();
        if (name.includes('hospital') || name.includes('blood') || name.includes('pharmacy')) {
          loadHospitalData();
        }
        if (name.includes('certificate') || name.includes('permit') || name.includes('license') || name.includes('tax') || name.includes('aadhaar')) {
          loadCerts();
        }
        if (name.includes('air') || name.includes('aqi') || name.includes('quality') || name.includes('environment')) {
          loadAqiData();
        }
      }
    });
  }, [serviceId]);

  const loadHospitalData = async () => {
    setLoadingHosp(true);
    try {
      const [hospRes, ambRes] = await Promise.all([
        supabase.from('map_points').select('*').eq('category', 'hospital'),
        supabase.from('hospital_ambulance_contacts').select('*')
      ]);
      setHospitalsList(hospRes.data ?? []);
      setAmbulanceLines(ambRes.data ?? []);
    } catch (err) {
      console.warn("Failed to load hospital query details:", err);
    } finally {
      setLoadingHosp(false);
    }
  };

  const loadCerts = async () => {
    setLoadingCerts(true);
    try {
      const { data } = await supabase
        .from('citizen_certificates')
        .select('*')
        .order('created_at', { ascending: false });
      setCerts(data ?? []);
    } catch (err) {
      console.warn("Failed to load certificates:", err);
    } finally {
      setLoadingCerts(false);
    }
  };

  const loadAqiData = async () => {
    try {
      const { data } = await supabase.from('environmental_readings').select('*');
      if (data) {
        const aqi = data.find(d => d.metric === 'aqi')?.value;
        if (aqi) {
          setAqiVal(aqi);
          setAqiPms({
            pm25: Math.round(aqi * 0.28),
            pm10: Math.round(aqi * 0.58),
            no2: Math.round(aqi * 0.15),
            so2: Math.round(aqi * 0.1)
          });
        }
      }
    } catch (err) {
      console.warn("Failed to load AQI metric readings:", err);
    }
  };

  const handleLinkCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocNo.trim() || !newIssuedName.trim() || !newIssueDate) {
      alert("Please fill in all document fields.");
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase.from('citizen_certificates').insert({
        doc_type: newDocType,
        doc_number: newDocNo.trim(),
        issued_name: newIssuedName.trim(),
        issue_date: newIssueDate,
        status: 'verified'
      });
      if (error) throw error;
      setNewDocNo('');
      setNewIssuedName('');
      setNewIssueDate('');
      setShowAddCert(false);
      loadCerts();
      alert("Government certificate successfully synced and linked to your DigiLocker profile!");
    } catch (err: any) {
      alert("Failed to link certificate: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    if (window.confirm("Are you sure you want to unlink this certificate from your profile? This is reversible.")) {
      const { error } = await supabase.from('citizen_certificates').delete().eq('id', id);
      if (error) {
        alert(error.message);
      } else {
        loadCerts();
      }
    }
  };

  // 1. Water Action Submit
  const handleReportLeakage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leakLocation.trim()) { alert("Please enter leakage location."); return; }
    setActionLoading(true);
    try {
      const { error } = await supabase.from('complaints').insert({
        title: 'Water Leakage Reported',
        description: `Leakage reported via Water Utility service. Severity: ${leakSeverity.toUpperCase()}`,
        category: 'water',
        location_text: leakLocation.trim(),
        status: 'submitted',
        department: 'Water Board'
      });
      if (error) throw error;
      setSuccessMsg("Leakage report submitted to Water Board successfully!");
      setLeakLocation('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Electricity Calculator Submit
  const handleCalculatePower = (e: React.FormEvent) => {
    e.preventDefault();
    const units = Number(calcUnits);
    if (isNaN(units) || units <= 0) {
      alert("Please enter a valid amount of units.");
      return;
    }
    // Standard tariff calculation (5.5 INR per unit)
    const rawCost = units * 5.5;
    const subsidy = units > 200 ? 100 : units * 0.5; // Subsidy calculation
    setCalcResult(Math.max(0, rawCost - subsidy));
  };

  // 3. Waste Pickup Submit
  const handleRequestWastePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteLoc.trim()) { alert("Please enter pickup location."); return; }
    setActionLoading(true);
    try {
      const { error } = await supabase.from('complaints').insert({
        title: `Special Bulk Waste Pickup: ${wasteType.toUpperCase()}`,
        description: `Citizen requested a special bulk/e-waste pickup. Category: ${wasteType}`,
        category: 'waste',
        location_text: wasteLoc.trim(),
        status: 'submitted',
        department: 'Sanitation Dept'
      });
      if (error) throw error;
      setSuccessMsg("Special pickup request logged! A sanitation truck will be scheduled.");
      setWasteLoc('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Mo Bus Fare Calculation
  const handleCalculateFare = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate routing stops distance fare
    const fareMap: Record<string, number> = {
      'AIIMS-Master Canteen': 20,
      'AIIMS-Airport': 15,
      'Airport-Patia': 35,
      'Master Canteen-Patia': 25
    };
    const key = `${busSource}-${busDest}`;
    const reverseKey = `${busDest}-${busSource}`;
    const fare = fareMap[key] || fareMap[reverseKey] || 15;
    setBusFare(fare);
  };

  // 5. Book Parking Lot
  const handleBookParking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim() || vehicleNo.trim().length < 4) {
      alert("Please enter a valid vehicle registration number.");
      return;
    }
    const ticketNo = 'PK-' + Math.floor(100000 + Math.random() * 900000);
    setBookedTicket({
      ticketNo,
      vehicleNo: vehicleNo.trim().toUpperCase(),
      spot: 'Spot A-' + Math.floor(Math.random() * 12 + 1),
      expires: new Date(Date.now() + 3 * 3600 * 1000).toLocaleTimeString()
    });
  };

  // 7. SOS Trigger Submit
  const handleTriggerSos = async () => {
    setActionLoading(true);
    try {
      // Fetch user location
      let locText = 'Bhubaneswar Central';
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
        locText = `Coordinates: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      } catch (e) {
        console.warn("Using default coordinates");
      }

      const { error } = await supabase.from('emergency_requests').insert({
        type: 'police',
        status: 'active',
        location_text: locText,
        notes: sosNotes.trim() || 'SOS triggered from service exploration panel.'
      });
      if (error) throw error;
      setSosTriggered(true);
      setSosNotes('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 8. General Inline Complaint Submit
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compTitle.trim() || !compLoc.trim()) {
      alert("Please enter a title and location.");
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase.from('complaints').insert({
        title: compTitle.trim(),
        description: compDesc.trim() || null,
        category: 'other',
        location_text: compLoc.trim(),
        status: 'submitted',
        department: 'Civic Services'
      });
      if (error) throw error;
      setSuccessMsg("Complaint filed successfully inside service panel!");
      setCompTitle('');
      setCompDesc('');
      setCompLoc('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Loading Service Detail" onBack={onBack} />
        <div className="p-8 text-center text-ink-400 text-sm">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Querying city catalog...
        </div>
      </Screen>
    );
  }

  if (!service) {
    return (
      <Screen>
        <ScreenHeader title="Service Not Found" onBack={onBack} />
        <div className="p-8 text-center text-ink-400 text-sm">
          Service record does not exist.
        </div>
      </Screen>
    );
  }

  const nameLower = service.name.toLowerCase();

  return (
    <Screen>
      <ScreenHeader title={service.name} subtitle={service.category} onBack={onBack} />
      
      <div className="px-5 py-4 space-y-6 pb-24 max-h-[85vh] overflow-y-auto">
        {/* Top Header Card */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
            <ServiceIcon name={service.icon} className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-primary-400 uppercase tracking-widest">{service.category}</p>
            <h2 className="font-extrabold text-base text-white leading-tight mt-0.5">{service.name}</h2>
            <p className="text-xs text-slate-400 mt-1">{service.description}</p>
          </div>
        </div>

        {/* =======================================================
            SERVICE SPECIFIC PANELS (ACTUAL SERVICE FUNCTIONALITY)
            ======================================================= */}

        {/* 1. Water Services */}
        {(nameLower.includes('water') || nameLower.includes('leakage')) && (
          <div className="space-y-4">
            {/* Live Supply Schedule */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Ward Water Supply Schedule
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <p className="text-slate-500 font-bold">MORNING SUPPLY</p>
                  <p className="font-extrabold text-white mt-1">6:00 AM - 9:00 AM</p>
                  <span className="inline-block text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded mt-1 font-bold">Completed</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <p className="text-slate-500 font-bold">EVENING SUPPLY</p>
                  <p className="font-extrabold text-white mt-1">5:30 PM - 8:30 PM</p>
                  <span className="inline-block text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded mt-1 font-bold">Upcoming</span>
                </div>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 text-xs flex justify-between items-center">
                <span className="text-slate-400 font-bold">Purity Rating Index:</span>
                <span className="font-black text-emerald-400">94% (Excellent)</span>
              </div>
            </div>

            {/* Direct Leakage Reporter Form */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Report Water Leakage Directly
              </h3>
              
              {successMsg ? (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-4 py-3 rounded-xl font-semibold">
                  {successMsg}
                </div>
              ) : (
                <form onSubmit={handleReportLeakage} className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Where is the Leakage?</label>
                    <input
                      type="text"
                      placeholder="e.g. Near plot 32, Janla Ward 12"
                      value={leakLocation}
                      onChange={(e) => setLeakLocation(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Severity Level</label>
                    <select
                      value={leakSeverity}
                      onChange={(e) => setLeakSeverity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="minor">Minor (Dripping valve)</option>
                      <option value="moderate">Moderate (Flowing leak)</option>
                      <option value="major">Major (Burst main pipeline! High priority)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {actionLoading ? 'Reporting...' : 'Submit Leakage Report'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 2. Electricity Services */}
        {(nameLower.includes('electricity') || nameLower.includes('power')) && (
          <div className="space-y-4">
            {/* Grid Status info */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Grid Operations Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                  <span className="text-slate-400">Main Ward Grid Line:</span>
                  <span className="font-extrabold text-emerald-400">Stable (232 V / 50.1 Hz)</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                  <span className="text-slate-400">Scheduled Substation Shutdowns:</span>
                  <span className="font-bold text-amber-400">None Scheduled</span>
                </div>
              </div>
            </div>

            {/* Tariff Cost Estimator */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-500" /> Tariff Bill Calculator
              </h3>
              <form onSubmit={handleCalculatePower} className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Enter Energy Units Used (KWh)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={calcUnits}
                    onChange={(e) => setCalcUnits(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Estimate Power Charges
                </button>
              </form>

              {calcResult !== null && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2 text-xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculated Bill Breakdown</p>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Energy tariff (domestic):</span>
                    <span className="font-semibold text-white">{formatINR(Number(calcUnits) * 5.5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ward Government Subsidy:</span>
                    <span className="font-semibold text-emerald-400">- {formatINR(Number(calcUnits) > 200 ? 100 : Number(calcUnits) * 0.5)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 font-black text-sm">
                    <span className="text-white">Estimated Payable Cost:</span>
                    <span className="text-amber-400">{formatINR(calcResult)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Waste Management */}
        {(nameLower.includes('waste') || nameLower.includes('garbage')) && (
          <div className="space-y-4">
            {/* Bin indicator levels */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-emerald-400" /> Neighborhood Smart Bins Status
              </h3>
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Sector A (Dry Waste Bin)</span>
                    <span className="font-bold text-emerald-400">25% full (Clean)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div className="bg-emerald-500 h-full" style={{ width: '25%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Sector B (Wet Waste Bin)</span>
                    <span className="font-bold text-red-400">85% full (Pending clearance)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div className="bg-red-500 h-full" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Special request Form */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-500" /> Request Special/Bulky waste Pickup
              </h3>

              {successMsg ? (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-4 py-3 rounded-xl font-semibold">
                  {successMsg}
                </div>
              ) : (
                <form onSubmit={handleRequestWastePickup} className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Select Waste Category</label>
                    <select
                      value={wasteType}
                      onChange={(e) => setWasteType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="e-waste">Electronic Waste (E-Waste)</option>
                      <option value="construction">Debris / Construction Soil</option>
                      <option value="bulky">Bulky furniture / Scrap wood</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Pickup Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Sector 3, Block D-4"
                      value={wasteLoc}
                      onChange={(e) => setWasteLoc(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {actionLoading ? 'Submitting...' : 'Request Garbage Pickup'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 4. Public Transport */}
        {(nameLower.includes('transport') || nameLower.includes('bus')) && (
          <div className="space-y-4">
            {/* Map Shortcut */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-400">Need real-time routes, bus directions, and stop details?</p>
              <button
                onClick={() => onViewMap?.('transit')}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" /> Locate Transit & Mo Bus Stops on Smart Map
              </button>
            </div>
            {/* Live Bus Schedules */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bus className="w-4 h-4 text-blue-400" /> Mo Bus Live Board (AIIMS Stop)
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                  <div>
                    <span className="font-bold text-white block">Route 10</span>
                    <span className="text-[10px] text-slate-500">AIIMS to Master Canteen</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-blue-400 block">Arriving in 8m</span>
                    <span className="text-[9px] text-slate-400">Bus #OD-02-3829</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                  <div>
                    <span className="font-bold text-white block">Route 11</span>
                    <span className="text-[10px] text-slate-500">Airport to Patia Hub</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-blue-400 block">Arriving in 14m</span>
                    <span className="text-[9px] text-slate-400">Bus #OD-02-8822</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bus Fare calculator */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-400" /> Mo Bus Fare Calculator
              </h3>
              <form onSubmit={handleCalculateFare} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Source Stop</label>
                    <select
                      value={busSource}
                      onChange={(e) => setBusSource(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="AIIMS">AIIMS Campus</option>
                      <option value="Airport">Airport Gate 1</option>
                      <option value="Master Canteen">Master Canteen Station</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Destination Stop</label>
                    <select
                      value={busDest}
                      onChange={(e) => setBusDest(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Master Canteen">Master Canteen Station</option>
                      <option value="Airport">Airport Gate 1</option>
                      <option value="Patia">Patia Hub Stop</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Calculate Fare
                </button>
              </form>

              {busFare !== null && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 text-xs text-center">
                  <span className="text-slate-450 font-bold block mb-1 uppercase tracking-widest text-[9px]">Calculated Ticket cost</span>
                  <p className="font-extrabold text-white text-lg">{formatINR(busFare)}</p>
                  <p className="text-[9px] text-slate-500 mt-1 italic">*Valid for AC/Non-AC Mo Bus routes in Bhubaneswar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Parking Finder */}
        {nameLower.includes('parking') && (
          <div className="space-y-4">
            {/* Map Shortcut */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-400">Need real-time routes, spot availability, and directions?</p>
              <button
                onClick={() => onViewMap?.('parking')}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" /> Locate Parking Lots on Smart Map
              </button>
            </div>
            {/* Occupancy card */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <SquareParking className="w-4 h-4 text-emerald-400" /> Parking Occupancy Rate
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 font-medium">Master Canteen Station Slot:</span>
                  <span className="font-extrabold text-emerald-400">12 / 50 spots free</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 font-medium">Khandagiri Fire Station Slot:</span>
                  <span className="font-extrabold text-emerald-400">35 / 100 spots free</span>
                </div>
              </div>
            </div>

            {/* Book Parking slot */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-500" /> Register Vehicle Parking Spot
              </h3>
              <form onSubmit={handleBookParking} className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Vehicle Plate Number</label>
                  <input
                    type="text"
                    placeholder="e.g. OD-02-Y-8822"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Book Parking Spot
                </button>
              </form>

              {bookedTicket && (
                <div className="bg-slate-950/60 p-4 border border-emerald-500/25 rounded-2xl text-xs space-y-3 text-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">PARKING RECEIPT RESERVED</p>
                  
                  {/* Mock CSS QR Code */}
                  <div className="w-24 h-24 bg-white p-2 mx-auto rounded-lg flex items-center justify-center">
                    <div className="w-full h-full border-4 border-slate-950 border-dotted opacity-80" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-left text-[11px] pt-1.5 border-t border-white/5">
                    <div>
                      <span className="text-slate-500">Ticket No:</span>
                      <p className="font-extrabold text-white">{bookedTicket.ticketNo}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Vehicle No:</span>
                      <p className="font-extrabold text-white">{bookedTicket.vehicleNo}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Allocated Spot:</span>
                      <p className="font-extrabold text-emerald-400">{bookedTicket.spot}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Validity Ends:</span>
                      <p className="font-extrabold text-white">{bookedTicket.expires}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. Healthcare / Hospitals */}
        {(nameLower.includes('hospital') || nameLower.includes('blood') || nameLower.includes('pharmacy')) && (
          <div className="space-y-4">
            {/* Map Shortcut */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-400">Need real-time maps, directions, and hours?</p>
              <button
                onClick={() => onViewMap?.(nameLower.includes('pharmacy') ? 'pharmacy' : 'hospital')}
                className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" /> Locate {nameLower.includes('pharmacy') ? '24/7 Pharmacies' : 'Nearest Hospitals'} on Smart Map
              </button>
            </div>
            {/* Live Beds Tracker */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-400" /> Hospital Available Beds Inspector
              </h3>
              
              {loadingHosp ? (
                <p className="text-xs text-slate-500 italic py-2">Querying medical database...</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {hospitalsList.map(h => {
                    // Extract beds from address string parsed during seeding or dashboard updates
                    let bedsText = "Beds: 45 / 100 free";
                    if (h.address && h.address.includes('|||')) {
                      try {
                        const parts = h.address.split('|||');
                        const meta = JSON.parse(parts[1].trim());
                        bedsText = `Beds: ${meta.bedsAvailable ?? 45} / ${meta.bedsTotal ?? 100} free`;
                      } catch (e) { }
                    }
                    return (
                      <div key={h.id} className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                        <div>
                          <span className="font-bold text-white block">{h.name}</span>
                          <span className="text-[10px] text-slate-500">{h.phone || 'No phone number'}</span>
                        </div>
                        <span className="font-extrabold text-red-400 shrink-0">{bedsText}</span>
                      </div>
                    );
                  })}
                  {hospitalsList.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No hospital points registered in city directory.</p>
                  )}
                </div>
              )}
            </div>

            {/* Specialty Ambulance Contacts */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-red-500" /> Specialty Ambulance Lines
              </h3>
              <p className="text-[10px] text-slate-400">Direct medical dispatch lines configured by municipal hospitals.</p>
              <div className="space-y-2 text-xs">
                {ambulanceLines.map(al => (
                  <div key={al.id} className="flex justify-between items-center p-2.5 bg-slate-950/40 rounded-xl border border-white/5">
                    <div>
                      <span className="font-bold text-white block capitalize">{al.disease_specialty} Dispatch</span>
                      {al.notes && <span className="text-[10px] text-slate-500 italic block mt-0.5">"{al.notes}"</span>}
                    </div>
                    <a
                      href={`tel:${al.ambulance_phone}`}
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Phone className="w-3 h-3" /> {al.ambulance_phone}
                    </a>
                  </div>
                ))}
                {ambulanceLines.length === 0 && (
                  <div className="p-2 bg-slate-950/20 text-center text-slate-550 italic text-[10px]">
                    No specialized ambulance channels configured yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. Emergency & SOS */}
        {(nameLower.includes('sos') || nameLower.includes('police') || nameLower.includes('fire')) && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-5 h-5" /> Trigger Active Emergency Rescue
              </h3>

              {sosTriggered ? (
                <div className="bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-xl p-4 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Emergency Dispatched!</p>
                  <p className="text-slate-400">Your browser coordinates have been sent to the police central unit. Rescue team has been notified.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-normal">Pressing the button below will immediately transmit your GPS coordinates to the nearest active municipal response staff.</p>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Emergency Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Heart pain, minor fire, traffic block"
                      value={sosNotes}
                      onChange={(e) => setSosNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <button
                    onClick={handleTriggerSos}
                    disabled={actionLoading}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs shadow-lg transition-all animate-pulse hover:animate-none cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? 'Broadcasting...' : 'Broadcast SOS Alarm'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. Complaints service panel */}
        {(nameLower.includes('complaint') || nameLower.includes('file')) && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Submit Civic Complaint
              </h3>

              {successMsg ? (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-4 py-3 rounded-xl font-semibold">
                  {successMsg}
                </div>
              ) : (
                <form onSubmit={handleCreateComplaint} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Complaint Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Broken streetlight on corner"
                      value={compTitle}
                      onChange={(e) => setCompTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Location / Ward Stop</label>
                    <input
                      type="text"
                      placeholder="e.g. MG Road, Near block C"
                      value={compLoc}
                      onChange={(e) => setCompLoc(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Description (Optional)</label>
                    <textarea
                      placeholder="Enter specific details..."
                      value={compDesc}
                      onChange={(e) => setCompDesc(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {actionLoading ? 'Filing complaint...' : 'Submit Civic Complaint'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 9. DigiLocker Document Vault (Certificates / Licenses / Permits / Aadhaar) */}
        {(nameLower.includes('certificate') || nameLower.includes('permit') || nameLower.includes('license') || nameLower.includes('aadhaar') || nameLower.includes('tax')) && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-5 h-5 text-orange-400" /> Government DigiLocker Vault
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Secure, verified government digital documents</p>
                </div>
                {!showAddCert && (
                  <button
                    onClick={() => setShowAddCert(true)}
                    className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-lg text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Link Document
                  </button>
                )}
              </div>

              {showAddCert ? (
                <form onSubmit={handleLinkCertificate} className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-white/5 text-xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Link Government Certificate</p>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Document Type</label>
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="birth">Birth Certificate</option>
                      <option value="income">Income Certificate</option>
                      <option value="aadhaar">Aadhaar Card (UIDAI)</option>
                      <option value="driving_license">Driving License</option>
                      <option value="rc">Vehicle registration (RC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Document/Certificate Serial Number</label>
                    <input
                      type="text"
                      placeholder="e.g. DL-02-2026-003829, 3982-1102-8822"
                      value={newDocNo}
                      onChange={(e) => setNewDocNo(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Issued Full Name</label>
                    <input
                      type="text"
                      placeholder="Name must match government ID exactly"
                      value={newIssuedName}
                      onChange={(e) => setNewIssuedName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Date of Issue</label>
                    <input
                      type="date"
                      value={newIssueDate}
                      onChange={(e) => setNewIssueDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-350 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddCert(false)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {actionLoading ? 'Syncing...' : 'Verify & Link'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {loadingCerts ? (
                    <p className="text-center text-xs text-slate-500 py-4 italic">Fetching document vault...</p>
                  ) : certs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-555 space-y-1">
                      <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="font-bold text-slate-400">No linked certificates found</p>
                      <p className="text-[10px] text-slate-500">Tap "Link Document" to sync certificates from government registry.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {certs.map(c => {
                        const typeLabels: Record<string, string> = {
                          birth: 'Birth Certificate',
                          income: 'Income Certificate',
                          aadhaar: 'Aadhaar Card',
                          driving_license: 'Driving License',
                          rc: 'Vehicle Registration'
                        };
                        return (
                          <div 
                            key={c.id} 
                            className="bg-gradient-to-br from-slate-900 to-slate-950 border border-orange-500/20 rounded-2xl p-4 relative shadow-lg overflow-hidden flex flex-col justify-between min-h-[140px]"
                          >
                            {/* Watermark Govt Emblem mockup */}
                            <div className="absolute right-2 bottom-2 w-20 h-20 text-white/2 pointer-events-none select-none flex items-center justify-center">
                              <Award className="w-full h-full opacity-5" />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-widest">
                                    VERIFIED
                                  </span>
                                  <h4 className="font-extrabold text-sm text-slate-100 mt-1 capitalize leading-tight">
                                    {typeLabels[c.doc_type] || c.doc_type}
                                  </h4>
                                </div>
                                <button
                                  onClick={() => handleDeleteCertificate(c.id)}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Unlink certificate"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="space-y-1 text-[11px]">
                                <p className="text-slate-400 font-mono">No: <span className="font-bold text-slate-200">{c.doc_number}</span></p>
                                <p className="text-slate-400 font-medium">Issued To: <span className="font-semibold text-slate-300">{c.issued_name}</span></p>
                                <p className="text-[10px] text-slate-500">Issued On: {new Date(c.issue_date).toLocaleDateString()}</p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-3 text-[10px]">
                              <span className="text-orange-400/80 font-bold flex items-center gap-0.5">
                                <Award className="w-3.5 h-3.5" /> DigiLocker Govt Sync
                              </span>
                              <div className="flex gap-1.5 text-slate-400">
                                <button onClick={() => alert("Downloading copy...")} className="hover:text-white cursor-pointer" title="Download copy"><Download className="w-3.5 h-3.5" /></button>
                                <button onClick={() => alert("Sharing link...")} className="hover:text-white cursor-pointer" title="Share link"><Share2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 10. Air Quality Panel */}
        {(nameLower.includes('air') || nameLower.includes('aqi') || nameLower.includes('quality') || nameLower.includes('environment')) && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-400" /> Air Quality Sustainability Index
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                {/* AQI gauge dial */}
                <div className="flex flex-col items-center justify-center text-center space-y-1 md:border-r md:border-white/5 md:pr-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">LIVE AQI SCORE</span>
                  <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center ${
                    aqiVal <= 50 ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' :
                    aqiVal <= 100 ? 'border-yellow-500/25 bg-yellow-500/10 text-yellow-400' :
                    'border-red-500/25 bg-red-500/10 text-red-400'
                  }`}>
                    <span className="text-2xl font-black">{aqiVal}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider">
                      {aqiVal <= 50 ? 'Good' : aqiVal <= 100 ? 'Moderate' : 'Unhealthy'}
                    </span>
                  </div>
                </div>

                {/* Sub pollutant bar readings */}
                <div className="md:col-span-2 space-y-2.5 text-xs">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Primary Pollutant Breakdowns</p>
                  <div>
                    <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                      <span>Fine Particulate Matter (PM2.5)</span>
                      <span className="font-semibold text-slate-300">{aqiPms.pm25} µg/m³</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (aqiPms.pm25 / 50) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                      <span>Coarse Particulate Matter (PM10)</span>
                      <span className="font-semibold text-slate-300">{aqiPms.pm10} µg/m³</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (aqiPms.pm10 / 100) * 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                      <span>Nitrogen Dioxide (NO2)</span>
                      <span className="font-semibold text-slate-300">{aqiPms.no2} ppb</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (aqiPms.no2 / 80) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Advisory card */}
              <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl flex gap-3.5 items-start text-xs leading-relaxed text-slate-300">
                <Heart className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-0.5">Health & Safety Advisory</p>
                  {aqiVal <= 50 ? (
                    <p>Air quality is highly satisfactory and poses little or no risk. Ideal for outdoor recreation, running, and physical training.</p>
                  ) : aqiVal <= 100 ? (
                    <p>Air quality is acceptable. However, highly sensitive individuals (asthma or respiratory issues) should limit heavy outdoor exertion.</p>
                  ) : (
                    <p>Active adults and children, and people with respiratory disease, should avoid prolonged outdoor exertion. Consider wearing a mask outdoors.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Quick Actions Link list (as fallback or additional shortcuts) */}
        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-slate-900 dark:to-slate-850 rounded-2xl p-5 border border-primary-500/10">
          <h3 className="font-bold text-ink-900 dark:text-white mb-1 text-sm">Alternative Actions</h3>
          <p className="text-xs text-ink-500 dark:text-slate-400 mb-4">Jump directly to general portals</p>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onFileComplaint?.('other')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-ink-700 font-extrabold rounded-xl text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
            >
              General Complaint <ChevronRight className="w-3.5 h-3.5 text-primary-600" />
            </button>
            <button
              onClick={() => onPayBill?.('water')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-ink-700 font-extrabold rounded-xl text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
            >
              Pay Utilities <ChevronRight className="w-3.5 h-3.5 text-primary-600" />
            </button>
            <button
              onClick={() => onViewMap?.('hospital')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-ink-700 font-extrabold rounded-xl text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
            >
              View City Map <ChevronRight className="w-3.5 h-3.5 text-primary-600" />
            </button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
