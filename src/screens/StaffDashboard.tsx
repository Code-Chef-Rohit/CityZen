import { useEffect, useState, useRef } from 'react';
import { 
  Shield, Phone, Navigation, Plus, MapPin, Trash2, CheckCircle2, 
  User, Mail, PlusCircle, AlertTriangle, Building, Building2, Flame, HeartPulse, 
  Bus, SquareParking, TreePine, Clock, X, Lock, LogOut, CheckCheck, Camera, ZoomIn, ZoomOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/Button';
import { formatINR } from '@/lib/utils';
import type { EmergencyRequest, Complaint, Profile, HospitalAmbulanceContact } from '@/lib/types';

export default function StaffDashboard() {
  const { profile, session, signOut } = useAuth();
  const role = profile?.role;

  // Shared Data States
  const [users, setUsers] = useState<Profile[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Police View States
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyRequest | null>(null);
  const [routingSim, setRoutingSim] = useState<{ distance: string; eta: string; steps: string[] } | null>(null);

  // 2. Hospital View States
  const [hospitalTab, setHospitalTab] = useState<'dispatches' | 'settings'>('dispatches');
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<any>(null);
  const [facName, setFacName] = useState('');
  const [facAddress, setFacAddress] = useState('');
  const [facPhone, setFacPhone] = useState('');
  const [facOpen24h, setFacOpen24h] = useState(true);
  const [facSaving, setFacSaving] = useState(false);
  const [facLat, setFacLat] = useState('20.2223');
  const [facLng, setFacLng] = useState('85.7335');

  const [ambulanceContacts, setAmbulanceContacts] = useState<HospitalAmbulanceContact[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // 3. BMC View States
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [resolutionProofText, setResolutionProofText] = useState('');
  const [resolutionProofPhoto, setResolutionProofPhoto] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const resolutionPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, emergenciesRes, complaintsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('emergency_requests').select('*, profiles(full_name, phone, email, ward)').order('created_at', { ascending: false }),
        supabase.from('complaints').select('*').order('created_at', { ascending: false })
      ]);
      setUsers(usersRes.data ?? []);
      let emergData = emergenciesRes.data;
      if (!emergData || emergData.length === 0) {
        const fallbackEmerg = await supabase.from('emergency_requests').select('*').order('created_at', { ascending: false });
        emergData = fallbackEmerg.data;
      }
      setEmergencies(emergData as any ?? []);
      setComplaints(complaintsRes.data ?? []);

      if (role === 'hospital' && profile?.id) {
        // Load hospital facilities owned or assigned to this user
        const { data: facs } = await supabase
          .from('map_points')
          .select('*')
          .eq('category', 'hospital');
        setFacilities(facs ?? []);
        
        // Find one assigned to this user (we can check phone match or choose first)
        if (facs && facs.length > 0) {
          const matched = facs.find((f: any) => f.phone === profile.phone) || facs[0];
          setSelectedFacility(matched);
          setFacName(matched.name);
          setFacAddress(matched.address || '');
          setFacPhone(matched.phone || '');
          setFacOpen24h(matched.open_24h);
          setFacLat(String(matched.lat));
          setFacLng(String(matched.lng));
        }

        // Load ambulance contacts
        const { data: contacts } = await supabase
          .from('hospital_ambulance_contacts')
          .select('*')
          .eq('hospital_user_id', profile.id)
          .order('created_at', { ascending: false });
        setAmbulanceContacts(contacts ?? []);
      }
    } catch (e) {
      console.error("Failed to load staff dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Setup live subscription for dispatches and complaints
    const channel = supabase
      .channel('staff_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_requests' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, profile?.id]);

  // 1. Police Actions
  const handleResolveEmergency = async (id: string) => {
    if (window.confirm("Mark this emergency SOS dispatch as fully resolved?")) {
      const { error } = await supabase
        .from('emergency_requests')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        alert(error.message);
      } else {
        setSelectedEmergency(null);
        setRoutingSim(null);
        loadData();
      }
    }
  };

  const [responderLocation, setResponderLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Live GPS tracking of responder position
  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setResponderLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.warn('Initial responder GPS lock:', err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setResponderLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.warn('Responder GPS unavailable:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }
    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const openGoogleMapsDirections = async (lat?: number | null, lng?: number | null, locationText?: string | null) => {
    let destLat = lat ? Number(lat) : null;
    let destLng = lng ? Number(lng) : null;

    if ((!destLat || !destLng || isNaN(destLat) || isNaN(destLng)) && locationText) {
      const match = locationText.match(/(?:Lat|GPS)[:\s]*([0-9.-]+)[,\s]+(?:Lng[:\s]*)?([0-9.-]+)/i);
      if (match) {
        destLat = parseFloat(match[1]);
        destLng = parseFloat(match[2]);
      }
    }

    let destination = '';
    if (destLat && destLng && !isNaN(destLat) && !isNaN(destLng)) {
      destination = `${destLat},${destLng}`;
    } else if (locationText && locationText.trim()) {
      destination = encodeURIComponent(locationText.trim());
    } else {
      destination = '20.2961,85.8245';
    }

    let originStr = '';
    if (responderLocation) {
      originStr = `${responderLocation.lat},${responderLocation.lng}`;
    } else if (navigator.geolocation) {
      try {
        const freshPos = await new Promise<GeolocationPosition>((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 3500, maximumAge: 0 });
        });
        const liveOrigin = { lat: freshPos.coords.latitude, lng: freshPos.coords.longitude };
        setResponderLocation(liveOrigin);
        originStr = `${liveOrigin.lat},${liveOrigin.lng}`;
      } catch (e) {
        // Fallback: omit origin so Google Maps navigates from user device's live GPS!
      }
    }

    const url = originStr
      ? `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    window.open(url, '_blank');
  };

  const simulateRouting = (emergency: EmergencyRequest) => {
    setSelectedEmergency(emergency);
    let distanceKm = '2.4';
    if (responderLocation && emergency.lat && emergency.lng) {
      distanceKm = getDistance(responderLocation.lat, responderLocation.lng, Number(emergency.lat), Number(emergency.lng)).toFixed(1);
    } else {
      distanceKm = (Math.random() * 3 + 1.2).toFixed(1);
    }
    const etaMin = Math.max(2, Math.round(Number(distanceKm) * 2.2));
    
    setRoutingSim({
      distance: `${distanceKm} km`,
      eta: `${etaMin} mins`,
      steps: [
        "Depart from current responder GPS patrol location",
        `Drive along main corridor towards ${emergency.location_text || 'target coordinates'} (${distanceKm} km)`,
        "Turn towards reported citizen distress beacon",
        `Arrive at citizen location: ${emergency.location_text || 'GPS Coordinates'}`
      ]
    });
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

  // 2. Hospital Actions
  const handleSaveFacility = async () => {
    if (!facName.trim()) { alert("Please provide facility name."); return; }
    setFacSaving(true);
    try {
      if (selectedFacility) {
        // Update
        const { error } = await supabase
          .from('map_points')
          .update({
            name: facName.trim(),
            address: facAddress.trim(),
            phone: facPhone.trim(),
            open_24h: facOpen24h,
            lat: Number(facLat),
            lng: Number(facLng)
          })
          .eq('id', selectedFacility.id);
        if (error) throw error;
        alert("Hospital facility updated successfully!");
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('map_points')
          .insert({
            name: facName.trim(),
            category: 'hospital',
            address: facAddress.trim(),
            phone: facPhone.trim(),
            open_24h: facOpen24h,
            lat: Number(facLat),
            lng: Number(facLng)
          })
          .select('*')
          .single();
        if (error) throw error;
        setSelectedFacility(data);
        alert("New hospital facility registered successfully!");
      }
      loadData();
    } catch (e: any) {
      alert("Error saving facility: " + e.message);
    } finally {
      setFacSaving(false);
    }
  };

  const handleAddAmbulanceContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialty.trim() || !newPhone.trim()) {
      alert("Please fill in specialty and contact number.");
      return;
    }
    setSavingContact(true);
    try {
      const { error } = await supabase
        .from('hospital_ambulance_contacts')
        .insert({
          hospital_user_id: profile?.id,
          disease_specialty: newSpecialty.trim(),
          ambulance_phone: newPhone.trim(),
          notes: newNotes.trim() || null
        });
      if (error) throw error;
      setNewSpecialty('');
      setNewPhone('');
      setNewNotes('');
      loadData();
    } catch (e: any) {
      alert("Error adding ambulance contact: " + e.message);
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteAmbulanceContact = async (id: string) => {
    if (window.confirm("Remove this ambulance contact specialty entry?")) {
      const { error } = await supabase
        .from('hospital_ambulance_contacts')
        .delete()
        .eq('id', id);
      if (error) {
        alert(error.message);
      } else {
        loadData();
      }
    }
  };

  // 3. BMC Actions
  const handleResolutionProofPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setResolutionProofPhoto(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleResolveComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!resolutionProofText.trim() || resolutionProofText.trim().length < 10) {
      alert("Please provide proper resolution proof details (minimum 10 characters).");
      return;
    }
    setSubmittingProof(true);
    try {
      // 1. Resolve master complaint
      const { error } = await supabase
        .from('complaints')
        .update({
          status: 'resolved',
          resolution_proof: resolutionProofText.trim(),
          resolution_photo_url: resolutionProofPhoto,
          resolved_at: new Date().toISOString()
        })
        .eq('id', selectedComplaint.id);
      
      if (error) throw error;

      // 2. Resolve all linked child duplicate complaints
      const childComplaints = complaints.filter(x => 
        x.description && (
          x.description.startsWith(`[ML_MERGE:${selectedComplaint.id}]`) ||
          x.description.includes(`[ML_CLUSTER_OVERLOAD:${selectedComplaint.id}`)
        )
      );

      if (childComplaints.length > 0) {
        const childIds = childComplaints.map(c => c.id);
        await supabase
          .from('complaints')
          .update({
            status: 'resolved',
            resolution_proof: resolutionProofText.trim(),
            resolution_photo_url: resolutionProofPhoto,
            resolved_at: new Date().toISOString()
          })
          .in('id', childIds);

        // Notify all citizens who reported this consolidated issue
        for (const child of childComplaints) {
          await supabase.from('notifications').insert({
            user_id: child.user_id,
            title: 'Consolidated Complaint Resolved by BMC',
            message: `Your report "${child.title}" has been completed. BMC Proof: ${resolutionProofText.trim()}`,
            type: 'complaint'
          });
        }
      }

      // Notify master citizen who filed
      await supabase.from('notifications').insert({
        user_id: selectedComplaint.user_id,
        title: 'Complaint Resolved by BMC',
        message: `Your complaint "${selectedComplaint.title}" has been completed. Proof: ${resolutionProofText.trim()}`,
        type: 'complaint'
      });

      setSelectedComplaint(null);
      setResolutionProofText('');
      setResolutionProofPhoto(null);
      loadData();
      alert(`Complaint ${childComplaints.length > 0 ? `and ${childComplaints.length} consolidated reports` : ''} marked resolved successfully with BMC proof photo!`);
    } catch (err: any) {
      alert("Failed to resolve complaint: " + err.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Shared Header */}
      <header className="bg-slate-900/60 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg shrink-0">
            <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight capitalize">{role} Control Panel</h1>
            <p className="text-xs text-slate-400">CityZen Digitized Staff Network</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-xs font-bold text-white">{profile?.full_name || 'Staff Responder'}</span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
              <Mail className="w-3 h-3 text-slate-500" /> {session?.user?.email || profile?.email || 'staff@cityzen.gov'}
            </span>
          </div>

          <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider ${
            role === 'police' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
            role === 'hospital' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            Role: Municipal {role}
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* POLICE DASHBOARD VIEW */}
          {role === 'police' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left Column: Active SOS List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h2 className="font-extrabold text-base text-blue-400 flex items-center gap-2">
                      <Shield className="w-5 h-5" /> Emergency SOS Dispatches
                    </h2>
                    <input
                      type="text"
                      placeholder="Filter alerts by type, city, ward..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 w-full sm:max-w-xs"
                    />
                  </div>

                  <div className="space-y-3">
                    {emergencies
                      .filter(e => 
                        e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (e.location_text && e.location_text.toLowerCase().includes(searchQuery.toLowerCase()))
                      )
                      .map(e => {
                        const citizen = (e as any).profiles || users.find(u => u.id === e.user_id);
                        const callerMatch = e.notes?.match(/\[Citizen:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Ward:\s*([^\]]+)\]/);
                        const callerName = citizen?.full_name || callerMatch?.[1]?.trim() || 'Citizen (SOS Sender)';
                        const callerPhone = citizen?.phone || callerMatch?.[2]?.trim() || '';
                        const callerWard = citizen?.ward || callerMatch?.[3]?.trim() || '';

                        let liveDistanceStr: string | null = null;
                        if (responderLocation && e.lat && e.lng) {
                          liveDistanceStr = `${getDistance(responderLocation.lat, responderLocation.lng, Number(e.lat), Number(e.lng)).toFixed(1)} km away`;
                        }

                        return (
                          <div 
                            key={e.id}
                            className={`border rounded-2xl p-4 transition-all ${
                              selectedEmergency?.id === e.id 
                                ? 'bg-slate-805 border-blue-500/40 ring-1 ring-blue-500/20 shadow-lg' 
                                : 'bg-slate-950/40 border-white/5 hover:bg-slate-950/80'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                              <div 
                                onClick={() => {
                                  setSelectedEmergency(e);
                                  simulateRouting(e);
                                  openGoogleMapsDirections(e.lat, e.lng, e.location_text);
                                }}
                                className="space-y-2 cursor-pointer group flex-1 min-w-0"
                                title="Click to view details and navigate to citizen location"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    e.type === 'ambulance' ? 'bg-red-500/10 text-red-400' :
                                    e.type === 'police' ? 'bg-blue-500/10 text-blue-400' :
                                    e.type === 'fire' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-purple-500/10 text-purple-400'
                                  }`}>
                                    {e.type} ALERT
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    e.status === 'active' ? 'bg-red-500/10 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {e.status}
                                  </span>
                                  {liveDistanceStr && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                      <Navigation className="w-3 h-3" /> {liveDistanceStr}
                                    </span>
                                  )}
                                </div>

                                {/* Citizen Profile Details Banner */}
                                <div className="bg-slate-900/90 rounded-xl p-3 border border-white/10 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                                        <User className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{callerName}</p>
                                        <p className="text-[10px] text-slate-400">
                                          {callerWard ? `Ward: ${callerWard}` : 'General Ward'}
                                          {citizen?.email ? ` • ${citizen.email}` : ''}
                                        </p>
                                      </div>
                                    </div>

                                    {callerPhone ? (
                                      <a
                                        href={`tel:${callerPhone}`}
                                        onClick={(ev) => ev.stopPropagation()}
                                        className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                                        title="Call citizen directly"
                                      >
                                        <Phone className="w-3.5 h-3.5" />
                                        <span>{callerPhone}</span>
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 italic shrink-0">No phone</span>
                                    )}
                                  </div>
                                </div>

                                {/* Location & GPS Info */}
                                <p className="font-extrabold text-xs text-slate-100 group-hover:text-blue-400 transition-colors flex items-start gap-1.5">
                                  <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                                  <span className="underline decoration-blue-500/40 truncate">{e.location_text || 'GPS Coordinates'}</span>
                                </p>
                                {e.lat && e.lng && (
                                  <p className="text-[10px] font-mono text-slate-400 pl-5">
                                    Exact GPS: {Number(e.lat).toFixed(5)}, {Number(e.lng).toFixed(5)}
                                  </p>
                                )}

                                <p className="text-xs text-slate-400 italic">"{e.notes || 'No description provided'}"</p>
                                <p className="text-[10px] text-slate-500">{new Date(e.created_at).toLocaleString()}</p>
                              </div>

                              <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedEmergency(e);
                                    simulateRouting(e);
                                    openGoogleMapsDirections(e.lat, e.lng, e.location_text);
                                  }}
                                  className="flex-1 sm:flex-none px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                                  title="Navigate from current GPS to citizen location"
                                >
                                  <Navigation className="w-3.5 h-3.5" /> Navigate (Maps)
                                </button>
                                {e.status === 'active' && (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleResolveEmergency(e.id);
                                    }}
                                    className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolve SOS
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {emergencies.length === 0 && (
                        <p className="text-center text-xs text-slate-500 py-6">No emergency SOS signals active. Stay vigilant!</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Citizen details & simulated GPS navigation */}
                <div className="space-y-4">
                  <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
                    <h3 className="font-extrabold text-sm text-white border-b border-white/5 pb-2">
                      Active Dispatch Details
                    </h3>

                    {selectedEmergency ? (
                      (() => {
                        const citizen = selectedEmergency.profiles || users.find(u => u.id === selectedEmergency.user_id);
                        const callerMatch = selectedEmergency.notes?.match(/\[Citizen:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Ward:\s*([^\]]+)\]/);
                        const callerName = citizen?.full_name || callerMatch?.[1]?.trim() || 'Registered Citizen';
                        const callerPhone = citizen?.phone || callerMatch?.[2]?.trim() || '';
                        const callerEmail = citizen?.email || '';
                        const callerWard = citizen?.ward || callerMatch?.[3]?.trim() || 'General';

                        return (
                          <div className="space-y-4 sm:space-y-5">
                            {/* Citizen private details card */}
                            <div className="bg-slate-950/60 p-3.5 sm:p-4 rounded-2xl border border-white/5 space-y-3">
                              <div className="flex items-center gap-2 text-blue-400">
                                <User className="w-4 h-4" />
                                <p className="text-xs font-bold uppercase tracking-wider">Citizen Registry Profile</p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-bold text-white truncate">{callerName}</p>
                                  {callerPhone && (
                                    <a
                                      href={`tel:${callerPhone}`}
                                      className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                                      title="Call citizen"
                                    >
                                      <Phone className="w-3.5 h-3.5" /> Call Now
                                    </a>
                                  )}
                                </div>
                                <p className="text-xs text-slate-350 flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-slate-500" /> {callerPhone || 'No contact phone'}
                                </p>
                                {callerEmail && (
                                  <p className="text-xs text-slate-350 flex items-center gap-1">
                                    <Mail className="w-3.5 h-3.5 text-slate-500" /> {callerEmail}
                                  </p>
                                )}
                                <span className="inline-block text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg mt-1 font-semibold">
                                  Ward Number: {callerWard}
                                </span>
                              </div>
                            </div>

                            {/* Exact Incident Location Directions */}
                            <div className="bg-slate-950/60 p-3.5 sm:p-4 rounded-2xl border border-white/5 space-y-2">
                              <div className="flex items-center gap-2 text-emerald-400">
                                <MapPin className="w-4 h-4" />
                                <p className="text-xs font-bold uppercase tracking-wider">Citizen Query Location</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-slate-200 font-medium">
                                  {selectedEmergency.location_text || 'Bhubaneswar Coordinates'}
                                </p>
                                {selectedEmergency.lat && selectedEmergency.lng && (
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    GPS: {Number(selectedEmergency.lat).toFixed(6)}, {Number(selectedEmergency.lng).toFixed(6)}
                                  </p>
                                )}
                                <button
                                  onClick={() => openGoogleMapsDirections(selectedEmergency.lat, selectedEmergency.lng, selectedEmergency.location_text)}
                                  className="w-full mt-2.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                                  title="Open turn-by-turn routing from current location to citizen"
                                >
                                  <Navigation className="w-4 h-4" /> Guide Me to Citizen (Google Maps Navigation)
                                </button>
                              </div>
                            </div>

                          {/* Simulated Directions block */}
                          {routingSim && (
                            <div className="bg-slate-950/40 p-3.5 sm:p-4 rounded-2xl border border-white/5 space-y-3 sm:space-y-4">
                              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                                <span className="text-slate-400 font-bold uppercase tracking-wider">Estimated Dispatch</span>
                                <span className="font-black text-blue-400">{routingSim.eta} ({routingSim.distance})</span>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Routing Instructions</p>
                                <div className="space-y-2.5 text-xs text-slate-305 pl-1">
                                  {routingSim.steps.map((step, idx) => (
                                    <div key={idx} className="flex gap-2.5 items-start">
                                      <span className="w-4 h-4 rounded-full bg-blue-600/20 border border-blue-500/25 flex items-center justify-center text-[9px] font-bold text-blue-400 shrink-0 mt-0.5">{idx + 1}</span>
                                      <span>{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Select an SOS request and click <strong>"Navigate"</strong> to review the citizen's profile and routing details.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* HOSPITAL DASHBOARD VIEW */}
          {role === 'hospital' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Hospital Action Tab Bar */}
              <div className="flex border-b border-white/10 gap-3 sm:gap-6 overflow-x-auto no-scrollbar scrollbar-none pb-0.5">
                <button
                  onClick={() => setHospitalTab('dispatches')}
                  className={`pb-2.5 text-xs sm:text-sm font-extrabold transition-all relative whitespace-nowrap cursor-pointer ${
                    hospitalTab === 'dispatches' ? 'text-red-400 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🚑 Ambulance SOS Dispatches
                </button>
                <button
                  onClick={() => setHospitalTab('settings')}
                  className={`pb-2.5 text-xs sm:text-sm font-extrabold transition-all relative whitespace-nowrap cursor-pointer ${
                    hospitalTab === 'settings' ? 'text-red-400 border-b-2 border-red-500' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🏢 Facility Settings
                </button>
              </div>

              {/* HOSPITAL DISPATCHES TAB */}
              {hospitalTab === 'dispatches' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Left Column: Ambulance SOS alerts */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h2 className="font-extrabold text-base text-red-400 flex items-center gap-2">
                          <HeartPulse className="w-5 h-5 animate-pulse" /> Active Ambulance Requests
                        </h2>
                        <input
                          type="text"
                          placeholder="Filter alerts by location..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 w-full sm:max-w-xs"
                        />
                      </div>

                      <div className="space-y-3">
                        {emergencies
                          .filter(e => e.type === 'ambulance')
                          .filter(e => 
                            !searchQuery || (e.location_text && e.location_text.toLowerCase().includes(searchQuery.toLowerCase()))
                          )
                          .map(e => {
                            const citizen = (e as any).profiles || users.find(u => u.id === e.user_id);
                            const callerMatch = e.notes?.match(/\[Citizen:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Ward:\s*([^\]]+)\]/);
                            const callerName = citizen?.full_name || callerMatch?.[1]?.trim() || 'Citizen (SOS Sender)';
                            const callerPhone = citizen?.phone || callerMatch?.[2]?.trim() || '';
                            const callerWard = citizen?.ward || callerMatch?.[3]?.trim() || '';

                            let liveDistanceStr: string | null = null;
                            if (responderLocation && e.lat && e.lng) {
                              liveDistanceStr = `${getDistance(responderLocation.lat, responderLocation.lng, Number(e.lat), Number(e.lng)).toFixed(1)} km away`;
                            }

                            return (
                              <div 
                                key={e.id}
                                className={`border rounded-2xl p-4 transition-all ${
                                  selectedEmergency?.id === e.id 
                                    ? 'bg-slate-805 border-red-500/40 ring-1 ring-red-500/20 shadow-lg' 
                                    : 'bg-slate-950/40 border-white/5 hover:bg-slate-950/80'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                  <div 
                                    onClick={() => {
                                      setSelectedEmergency(e);
                                      simulateRouting(e);
                                      openGoogleMapsDirections(e.lat, e.lng, e.location_text);
                                    }}
                                    className="space-y-2 cursor-pointer group flex-1 min-w-0"
                                    title="Click to view details and navigate to citizen location"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/10 text-red-400">
                                        AMBULANCE ALERT
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                        e.status === 'active' ? 'bg-red-500/10 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'
                                      }`}>
                                        {e.status}
                                      </span>
                                      {liveDistanceStr && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                          <Navigation className="w-3 h-3" /> {liveDistanceStr}
                                        </span>
                                      )}
                                    </div>

                                    {/* Citizen Profile Details Banner */}
                                    <div className="bg-slate-900/90 rounded-xl p-3 border border-white/10 space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                                            <User className="w-4 h-4" />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{callerName}</p>
                                            <p className="text-[10px] text-slate-400">
                                              {callerWard ? `Ward: ${callerWard}` : 'General Ward'}
                                              {citizen?.email ? ` • ${citizen.email}` : ''}
                                            </p>
                                          </div>
                                        </div>

                                        {callerPhone ? (
                                          <a
                                            href={`tel:${callerPhone}`}
                                            onClick={(ev) => ev.stopPropagation()}
                                            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                                            title="Call citizen directly"
                                          >
                                            <Phone className="w-3.5 h-3.5" />
                                            <span>{callerPhone}</span>
                                          </a>
                                        ) : (
                                          <span className="text-[10px] text-slate-500 italic shrink-0">No phone</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Location & GPS Info */}
                                    <p className="font-extrabold text-xs text-slate-100 group-hover:text-red-400 transition-colors flex items-start gap-1.5">
                                      <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                                      <span className="underline decoration-red-500/40">{e.location_text || 'GPS Coordinates'}</span>
                                    </p>
                                    {e.lat && e.lng && (
                                      <p className="text-[10px] font-mono text-slate-400 pl-5">
                                        Exact GPS: {Number(e.lat).toFixed(5)}, {Number(e.lng).toFixed(5)}
                                      </p>
                                    )}

                                    <p className="text-xs text-slate-400 italic">"{e.notes || 'No description provided'}"</p>
                                    <p className="text-[10px] text-slate-500">{new Date(e.created_at).toLocaleString()}</p>
                                  </div>

                                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedEmergency(e);
                                        simulateRouting(e);
                                        openGoogleMapsDirections(e.lat, e.lng, e.location_text);
                                      }}
                                      className="flex-1 sm:flex-none px-3.5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-600/20"
                                      title="Navigate from current GPS to citizen location"
                                    >
                                      <Navigation className="w-3.5 h-3.5" /> Navigate (Maps)
                                    </button>
                                    {e.status === 'active' && (
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleResolveEmergency(e.id);
                                        }}
                                        className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve SOS
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {emergencies.filter(e => e.type === 'ambulance').length === 0 && (
                          <p className="text-center text-xs text-slate-500 py-6 italic">No ambulance requests active. All is well!</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Citizen details & simulated directions */}
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
                      <h3 className="font-extrabold text-sm text-white border-b border-white/5 pb-2">
                        Active Dispatch Details
                      </h3>

                      {selectedEmergency && selectedEmergency.type === 'ambulance' ? (
                        (() => {
                          const citizen = selectedEmergency.profiles || users.find(u => u.id === selectedEmergency.user_id);
                          const callerMatch = selectedEmergency.notes?.match(/\[Citizen:\s*([^|]+)\s*\|\s*Phone:\s*([^|]+)\s*\|\s*Ward:\s*([^\]]+)\]/);
                          const callerName = citizen?.full_name || callerMatch?.[1]?.trim() || 'Registered Citizen';
                          const callerPhone = citizen?.phone || callerMatch?.[2]?.trim() || '';
                          const callerEmail = citizen?.email || '';
                          const callerWard = citizen?.ward || callerMatch?.[3]?.trim() || 'General';

                          return (
                            <div className="space-y-4 sm:space-y-5">
                              {/* Citizen private details card */}
                              <div className="bg-slate-950/60 p-3.5 sm:p-4 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex items-center gap-2 text-red-400">
                                  <User className="w-4 h-4" />
                                  <p className="text-xs font-bold uppercase tracking-wider">Citizen Registry Profile</p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-white truncate">{callerName}</p>
                                    {callerPhone && (
                                      <a
                                        href={`tel:${callerPhone}`}
                                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                                        title="Call citizen"
                                      >
                                        <Phone className="w-3.5 h-3.5" /> Call Now
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-350 flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5 text-slate-500" /> {callerPhone || 'No contact phone'}
                                  </p>
                                  {callerEmail && (
                                    <p className="text-xs text-slate-350 flex items-center gap-1">
                                      <Mail className="w-3.5 h-3.5 text-slate-500" /> {callerEmail}
                                    </p>
                                  )}
                                  <span className="inline-block text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg mt-1 font-semibold">
                                    Ward Number: {callerWard}
                                  </span>
                                </div>
                              </div>

                              {/* Exact Incident Location Directions */}
                              <div className="bg-slate-950/60 p-3.5 sm:p-4 rounded-2xl border border-white/5 space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400">
                                  <MapPin className="w-4 h-4" />
                                  <p className="text-xs font-bold uppercase tracking-wider">Citizen Query Location</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-200 font-medium">
                                    {selectedEmergency.location_text || 'Bhubaneswar Coordinates'}
                                  </p>
                                  {selectedEmergency.lat && selectedEmergency.lng && (
                                    <p className="text-[11px] text-slate-400 font-mono">
                                      GPS: {Number(selectedEmergency.lat).toFixed(6)}, {Number(selectedEmergency.lng).toFixed(6)}
                                    </p>
                                  )}
                                  <button
                                    onClick={() => openGoogleMapsDirections(selectedEmergency.lat, selectedEmergency.lng, selectedEmergency.location_text)}
                                    className="w-full mt-2.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                                    title="Open turn-by-turn routing from current location to citizen"
                                  >
                                    <Navigation className="w-4 h-4" /> Guide Me to Citizen (Google Maps Navigation)
                                  </button>
                                </div>
                              </div>

                              {/* Simulated Directions block */}
                              {routingSim && (
                                <div className="bg-slate-950/40 p-3.5 sm:p-4 rounded-2xl border border-white/5 space-y-3 sm:space-y-4">
                                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider">Estimated Dispatch</span>
                                    <span className="font-black text-red-400">{routingSim.eta} ({routingSim.distance})</span>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Routing Instructions</p>
                                    <div className="space-y-2.5 text-xs text-slate-305 pl-1">
                                      {routingSim.steps.map((step, idx) => (
                                        <div key={idx} className="flex gap-2.5 items-start">
                                          <span className="w-4 h-4 rounded-full bg-red-600/20 border border-red-500/25 flex items-center justify-center text-[9px] font-bold text-red-400 shrink-0 mt-0.5">{idx + 1}</span>
                                          <span>{step}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="py-12 text-center text-xs text-slate-500">
                          Select an active ambulance request and click <strong>"Navigate"</strong> to review the citizen's profile and routing details.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* HOSPITAL SETTINGS TAB */}
              {hospitalTab === 'settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Left Side: Hospital Facility Manager Form */}
                  <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
                    <h2 className="font-extrabold text-base text-red-405 flex items-center gap-2 mb-5">
                      <Building2 className="w-5 h-5" /> Facility details registry
                    </h2>

                    <div className="space-y-4">
                      {selectedFacility && (
                        <div className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-white/5 text-xs">
                          <span className="text-slate-500 font-bold">LINKED POINT ID:</span> <span className="font-mono text-slate-350">{selectedFacility.id}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Hospital / Facility Name</label>
                          <input
                            type="text"
                            value={facName}
                            onChange={(e) => setFacName(e.target.value)}
                            placeholder="e.g. AIIMS Hospital Bhubaneswar"
                            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Contact Hotline Number</label>
                          <input
                            type="text"
                            value={facPhone}
                            onChange={(e) => setFacPhone(e.target.value)}
                            placeholder="e.g. 0674-247-6600"
                            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Facility Address</label>
                        <input
                          type="text"
                          value={facAddress}
                          onChange={(e) => setFacAddress(e.target.value)}
                          placeholder="Sijua, Patrapada, Bhubaneswar, Odisha 751019"
                          className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Latitude Coordinate</label>
                          <input
                            type="text"
                            value={facLat}
                            onChange={(e) => setFacLat(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Longitude Coordinate</label>
                          <input
                            type="text"
                            value={facLng}
                            onChange={(e) => setFacLng(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Operational Hours</label>
                          <div className="flex items-center gap-2 h-11 bg-slate-950 px-4 rounded-xl border border-white/10">
                            <input
                              type="checkbox"
                              id="open24h"
                              checked={facOpen24h}
                              onChange={(e) => setFacOpen24h(e.target.checked)}
                              className="w-4 h-4 rounded accent-red-500 cursor-pointer"
                            />
                            <label htmlFor="open24h" className="text-xs font-semibold text-slate-300 cursor-pointer">Open 24/7</label>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 text-right">
                        <Button onClick={handleSaveFacility} loading={facSaving} className="w-full sm:w-auto bg-red-650 hover:bg-red-700 text-white font-bold px-6">
                          <CheckCircle2 className="w-4 h-4" /> Save Facility Details
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Disease Ambulance Numbers Management */}
                  <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-5 sm:space-y-6">
                    <div>
                      <h2 className="font-extrabold text-sm text-red-405 flex items-center gap-2 mb-1.5">
                        <HeartPulse className="w-4 h-4" /> Ambulance & Specialities
                      </h2>
                      <p className="text-[10px] text-slate-400">Configure emergency dispatch lines for specific diseases.</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAddAmbulanceContact} className="space-y-3 bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Register Specialty Hotline</p>
                      <div>
                        <input
                          type="text"
                          placeholder="Specialty (e.g. Cardiac Arrest, Trauma)"
                          value={newSpecialty}
                          onChange={(e) => setNewSpecialty(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Ambulance Hotline Number"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={newNotes}
                          onChange={(e) => setNewNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingContact}
                        className="w-full py-2 bg-red-650 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" /> Add Speciality Line
                      </button>
                    </form>

                    {/* List */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Registered Hotline Numbers</p>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {ambulanceContacts.map(ac => (
                          <div key={ac.id} className="bg-slate-950/60 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-white capitalize">{ac.disease_specialty}</p>
                              <p className="font-semibold text-red-400 mt-0.5">{ac.ambulance_phone}</p>
                              {ac.notes && <p className="text-[10px] text-slate-550 italic mt-0.5">"{ac.notes}"</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteAmbulanceContact(ac.id)}
                              className="p-1 text-slate-500 hover:text-red-505 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {ambulanceContacts.length === 0 && (
                          <p className="text-center text-[10px] text-slate-550 py-4 italic">No ambulance specialities added yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BMC DASHBOARD VIEW */}
          {role === 'bmc' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left Column: Complaints list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h2 className="font-extrabold text-base text-amber-400 flex items-center gap-2">
                      <Building className="w-5 h-5" /> Civic Complaint Logs
                    </h2>
                    <input
                      type="text"
                      placeholder="Filter complaints by title, ward..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 w-full sm:max-w-xs"
                    />
                  </div>

                  <div className="space-y-3">
                    {complaints
                      .filter(c => 
                        !c.description?.startsWith('[ML_MERGE:') && 
                        !c.description?.startsWith('[ML_CLUSTER_OVERLOAD:') && (
                          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.category.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                      )
                      .map(c => (
                        <div 
                          key={c.id}
                          className={`border rounded-2xl p-4 transition-all ${
                            selectedComplaint?.id === c.id 
                              ? 'bg-slate-805 border-amber-500/40 ring-1 ring-amber-500/20' 
                              : 'bg-slate-950/40 border-white/5 hover:bg-slate-950/80'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                            <div className="space-y-1 pr-4 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-500/10 text-amber-400">
                                  {c.category}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  c.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  c.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                                  'bg-red-500/10 text-red-400'
                                }`}>
                                  {c.status}
                                </span>
                                {c.title.includes('[CRITICAL OVERLOAD]') && (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-red-650/30 text-red-400 border border-red-500/20 animate-pulse">
                                    🚨 OVERLOAD CLUSTER ({complaints.filter(x => x.description?.includes(`[ML_CLUSTER_OVERLOAD:${c.id}`) || x.description?.includes(`[ML_MERGE:${c.id}`)).length + 1} REPORTS)
                                  </span>
                                )}
                              </div>
                              <p className="font-extrabold text-sm text-slate-100">{c.title}</p>
                              <p className="text-xs text-slate-400">{c.description || 'No description provided.'}</p>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-1">
                                <span 
                                  onClick={() => openGoogleMapsDirections(c.lat, c.lng, c.location_text)}
                                  className="flex items-center gap-1 text-slate-300 font-medium cursor-pointer hover:text-amber-400 hover:underline transition-colors"
                                  title="Click to open directions in Google Maps"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-amber-400" /> {c.location_text || 'Bhubaneswar, Odisha'}
                                </span>
                                <button
                                  onClick={() => openGoogleMapsDirections(c.lat, c.lng, c.location_text)}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/25 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                  title="Navigate from my location to incident in Google Maps"
                                >
                                  <Navigation className="w-3 h-3" /> Guide Me (Maps)
                                </button>
                              </div>

                              {c.status === 'resolved' && (
                                <div className="mt-2.5 p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/15 text-[11px] space-y-1.5">
                                  <span className="font-bold text-emerald-400 block uppercase tracking-wider text-[8px]">LOGGED REPAIR PROOF</span>
                                  {c.resolution_proof && <p className="text-emerald-300 italic">"{c.resolution_proof}"</p>}
                                  {c.resolution_photo_url && (
                                    <div 
                                      onClick={() => setPreviewPhoto(c.resolution_photo_url!)}
                                      className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer font-bold"
                                    >
                                      <Camera className="w-3 h-3" /> View BMC Proof Photo
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
                              {c.status !== 'resolved' ? (
                                <button
                                  onClick={() => { setSelectedComplaint(c); setResolutionProofText(''); setResolutionProofPhoto(null); }}
                                  className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <CheckCheck className="w-4 h-4" /> Resolve Job
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4" /> Resolved
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    {complaints.length === 0 && (
                      <p className="text-center text-xs text-slate-500 py-6">No municipal complaints registered yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Resolution modal or privacy verification checks */}
              <div className="space-y-4">
                <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
                  <h3 className="font-extrabold text-sm text-white border-b border-white/5 pb-2">
                    Operations Inspector
                  </h3>

                  {selectedComplaint ? (
                    <form onSubmit={handleResolveComplaint} className="space-y-4">
                      {/* Privacy masking visualization */}
                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-500">
                          <Lock className="w-4 h-4" />
                          <p className="font-bold uppercase tracking-wider text-[10px]">Privacy Security Mask Active</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400">Filed By:</p>
                          <p className="font-mono text-slate-500 font-bold italic">[Citizen details hidden for privacy]</p>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-normal">In compliance with citizen data protection laws, municipal operators can see the query and coordinates but not the caller's identity.</p>
                      </div>

                      {/* GPS Geolocation and Guide Link */}
                      <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-400 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-amber-400" /> Incident Location
                          </span>
                          {selectedComplaint.lat && selectedComplaint.lng && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {Number(selectedComplaint.lat).toFixed(4)}, {Number(selectedComplaint.lng).toFixed(4)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 font-medium">
                          {selectedComplaint.location_text || 'Bhubaneswar, Odisha'}
                        </p>
                        <button
                          type="button"
                          onClick={() => openGoogleMapsDirections(selectedComplaint.lat, selectedComplaint.lng, selectedComplaint.location_text)}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                          title="Open turn-by-turn routing from current location to incident in Google Maps"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Guide Me to Incident (Google Maps Navigation)
                        </button>
                      </div>

                      {/* Photo Evidence */}
                      {selectedComplaint.photo_url && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Citizen Photo Evidence (Before)</label>
                          <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-slate-950 flex items-center justify-center">
                            <img 
                              src={selectedComplaint.photo_url} 
                              alt="Evidence" 
                              className="w-full h-full object-cover cursor-zoom-in hover:scale-102 transition-transform duration-300"
                              onClick={() => selectedComplaint.photo_url && setPreviewPhoto(selectedComplaint.photo_url)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Resolution Proof Photo Uploader */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Upload BMC Repair Proof Photo (After)</label>
                        <input
                          type="file"
                          accept="image/*"
                          ref={resolutionPhotoInputRef}
                          onChange={handleResolutionProofPhotoChange}
                          className="hidden"
                        />
                        {resolutionProofPhoto ? (
                          <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 aspect-video bg-slate-950 flex items-center justify-center group">
                            <img src={resolutionProofPhoto} alt="Resolution Proof Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setResolutionProofPhoto(null)}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => resolutionPhotoInputRef.current?.click()}
                            className="w-full py-4 border border-dashed border-white/15 rounded-2xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors cursor-pointer"
                          >
                            <Camera className="w-5 h-5 text-amber-400" />
                            <span className="text-[11px] font-semibold text-slate-300">Attach Resolution Proof Photo</span>
                          </button>
                        )}
                      </div>

                      {/* Resolution Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Submit Resolution Proof Notes</label>
                        <textarea
                          placeholder="Provide descriptive details of repair actions taken (e.g. replaced pole bulb, sealed leakage, cleared waste heap). Min 10 characters."
                          value={resolutionProofText}
                          onChange={(e) => setResolutionProofText(e.target.value)}
                          rows={3}
                          required
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setSelectedComplaint(null); setResolutionProofText(''); setResolutionProofPhoto(null); }}
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingProof}
                          className="flex-1 py-2.5 bg-emerald-650 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/10"
                        >
                          {submittingProof ? 'Submitting...' : 'Complete Resolve'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-500 leading-relaxed">
                      Select an outstanding complaint and tap <strong>"Resolve Job"</strong> to review privacy logs and submit resolution proof records.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      )}
      {/* Photo Preview Lightbox Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => { setPreviewPhoto(null); setZoomScale(1); }} />
          <div className="relative max-w-3xl w-full bg-slate-900 border border-white/10 rounded-3xl p-5 overflow-hidden flex flex-col items-center justify-center animate-slide-up shadow-2xl">
            <button
              onClick={() => { setPreviewPhoto(null); setZoomScale(1); }}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-950/60 border border-white/10 text-white flex items-center justify-center hover:bg-slate-950 transition-colors cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-full overflow-auto flex items-center justify-center rounded-2xl bg-black/40 p-2 border border-white/5 max-h-[70vh]">
              <img 
                src={previewPhoto} 
                alt="Evidence Lightbox" 
                className="max-w-full max-h-[65vh] object-contain rounded-xl transition-transform duration-200" 
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>
            
            {/* Interactive Zoom Controller */}
            <div className="mt-4 flex items-center gap-3 bg-slate-950/80 border border-white/10 rounded-full px-4 py-2 text-white shadow-lg">
              <button 
                type="button"
                onClick={() => setZoomScale(s => Math.max(1, s - 0.25))}
                className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold font-mono min-w-[40px] text-center">{Math.round(zoomScale * 100)}%</span>
              <button 
                type="button"
                onClick={() => setZoomScale(s => Math.min(3.5, s + 0.25))}
                className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button 
                type="button"
                onClick={() => setZoomScale(1)}
                className="text-[10px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
