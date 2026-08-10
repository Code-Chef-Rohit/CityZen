import { useEffect, useState, useRef } from 'react';
import {
  Plus, AlertCircle, MapPin, Camera, CheckCircle2, Clock, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Complaint, ComplaintCategory, ComplaintStatus } from '@/lib/types';

const categories: { value: ComplaintCategory; label: string }[] = [
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'waste', label: 'Waste' },
  { value: 'roads', label: 'Roads' },
  { value: 'streetlight', label: 'Streetlight' },
  { value: 'other', label: 'Other' },
];

const statusFlow: ComplaintStatus[] = ['submitted', 'assigned', 'in_progress', 'resolved'];

// ML Perceptual Hashing (Average Hash algorithm)
const getImageHash = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }
      ctx.drawImage(img, 0, 0, 8, 8);
      const imgData = ctx.getImageData(0, 0, 8, 8).data;
      
      let total = 0;
      const greyValues = [];
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i+1];
        const b = imgData[i+2];
        const grey = 0.299 * r + 0.587 * g + 0.114 * b;
        greyValues.push(grey);
        total += grey;
      }
      const average = total / 64;
      
      let hash = '';
      for (let i = 0; i < 64; i++) {
        hash += greyValues[i] >= average ? '1' : '0';
      }
      resolve(hash);
    };
    img.onerror = () => resolve('');
    img.src = base64Str;
  });
};

const getHammingDistance = (hash1: string, hash2: string): number => {
  if (hash1.length !== hash2.length || hash1.length === 0) return 999;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
};

export function Complaints({ onBack }: { onBack: () => void }) {
  const { session } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [complaintTab, setComplaintTab] = useState<'all' | 'my'>('all');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);

  const load = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });
    setComplaints(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [session]);

  const handleCreated = () => {
    setShowNew(false);
    load();
  };

  // Filter complaints based on active tab selection
  const displayedComplaints = complaints.filter(c => {
    if (complaintTab === 'my') {
      return c.user_id === session?.user?.id;
    }
    // For 'all' city feed, filter out child duplicates to prevent UI spam!
    return !c.description?.startsWith('[ML_MERGE:');
  });

  return (
    <Screen>
      <ScreenHeader
        title="Complaints"
        subtitle={`${displayedComplaints.length} reports`}
        onBack={onBack}
        right={
          <button
            onClick={() => setShowNew(true)}
            className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white shadow-sm hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-4 py-4">
        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-ink-50 dark:bg-slate-900 rounded-xl mb-4 border border-ink-100 dark:border-slate-800">
          <button
            onClick={() => setComplaintTab('all')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              complaintTab === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-700 dark:text-slate-400'
            }`}
          >
            City Feed
          </button>
          <button
            onClick={() => setComplaintTab('my')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              complaintTab === 'my'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-ink-500 hover:text-ink-700 dark:text-slate-400'
            }`}
          >
            My Reports
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl h-24 skeleton" />)}
          </div>
        ) : displayedComplaints.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-800 dark:bg-slate-900">
            <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-slate-850 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-ink-400" />
            </div>
            <p className="font-semibold text-ink-700 dark:text-slate-200">No complaints found</p>
            <p className="text-sm text-ink-400 dark:text-slate-400 mt-1 mb-4">
              {complaintTab === 'my' ? "You haven't filed any complaints yet." : "No reports active in your city."}
            </p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" /> File a Complaint
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedComplaints.map((c) => {
              const isDuplicate = c.description?.startsWith('[ML_MERGE:');
              const cleanDesc = isDuplicate ? c.description?.replace(/\[ML_MERGE:[^\]]+\]/, '').trim() : c.description;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="w-full bg-white rounded-2xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 flex items-center gap-1.5">
                        {c.title}
                        {isDuplicate && (
                          <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">Duplicate Merged</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-400 mt-0.5 capitalize">{c.category}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  {cleanDesc && (
                    <p className="text-sm text-ink-500 mt-2 line-clamp-2">{cleanDesc}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-ink-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(c.created_at)}
                    </span>
                    {c.location_text && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" /> {c.location_text}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <NewComplaintModal open={showNew} onClose={() => setShowNew(false)} onCreated={handleCreated} userId={session?.user?.id ?? ''} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Complaint Details">
        {selected && <ComplaintDetail complaint={selected} />}
      </Modal>
    </Screen>
  );
}

function ComplaintDetail({ complaint }: { complaint: Complaint }) {
  const currentStep = statusFlow.indexOf(complaint.status);
  const isDuplicate = complaint.description?.startsWith('[ML_MERGE:');
  const cleanDesc = isDuplicate ? complaint.description?.replace(/\[ML_MERGE:[^\]]+\]/, '').trim() : complaint.description;

  return (
    <div className="space-y-5">
      <div>
        <StatusBadge status={complaint.status} />
        <h3 className="font-bold text-ink-900 text-lg mt-2">{complaint.title}</h3>
        {cleanDesc && <p className="text-sm text-ink-500 mt-1">{cleanDesc}</p>}
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-400">
        <span className="px-2 py-1 bg-ink-100 rounded-full capitalize">{complaint.category}</span>
        {complaint.department && <span className="px-2 py-1 bg-secondary-100 rounded-full text-secondary-700">{complaint.department}</span>}
        {isDuplicate && <span className="px-2 py-1 bg-orange-100 rounded-full text-orange-700 font-bold text-[10px]">Duplicate Linked (Storage Saved)</span>}
      </div>

      {complaint.location_text && (
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <MapPin className="w-4 h-4 text-ink-400" /> {complaint.location_text}
        </div>
      )}

      {complaint.photo_url && (
        <div className="rounded-2xl overflow-hidden border border-slate-100 max-h-60 flex items-center justify-center bg-slate-50">
          <img src={complaint.photo_url} alt="Complaint Attachment" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Progress tracker */}
      <div className="bg-ink-50 rounded-2xl p-4">
        <p className="text-xs font-bold text-ink-500 mb-4">TRACKING TIMELINE</p>
        <div className="space-y-0">
          {statusFlow.map((status, i) => {
            const done = i <= currentStep;
            const isLast = i === statusFlow.length - 1;
            return (
              <div key={status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    done ? 'bg-primary-500 text-white' : 'bg-ink-200 text-ink-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </div>
                  {!isLast && <div className={`w-0.5 h-8 ${done ? 'bg-primary-300' : 'bg-ink-200'}`} />}
                </div>
                <div className="pt-1">
                  <p className={`text-sm font-semibold capitalize ${done ? 'text-ink-800' : 'text-ink-400'}`}>
                    {status.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-ink-400">
                    {i === 0 && formatDate(complaint.created_at)}
                    {i === 3 && complaint.resolved_at && formatDate(complaint.resolved_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NewComplaintModal({ open, onClose, onCreated, userId }: {
  open: boolean; onClose: () => void; onCreated: () => void; userId: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('water');
  const [location, setLocation] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mlAnalyzing, setMlAnalyzing] = useState(false);
  const [mlMatchMsg, setMlMatchMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; // Resize to keep DB storage light & fast!
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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setSelectedPhoto(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Please enter a title'); return; }
    if (!location.trim()) { setError('Please enter a location'); return; }
    
    setSubmitting(true);
    setMlAnalyzing(true);
    setMlMatchMsg(null);
    setError(null);

    const deptMap: Record<ComplaintCategory, string> = {
      water: 'Water Board', electricity: 'Electricity Board', waste: 'Sanitation Dept',
      roads: 'Public Works', streetlight: 'Municipal Corp', other: 'Civic Services',
    };

    try {
      // 1. Compute perceptual hash of the uploaded image
      let uploadedHash = '';
      if (selectedPhoto) {
        uploadedHash = await getImageHash(selectedPhoto);
      }

      // Simulate ML feature analysis delay
      await new Promise(r => setTimeout(r, 1600));

      // 2. Fetch existing complaints to scan for location & image matches
      const { data: existing } = await supabase.from('complaints').select('*');

      let match: any = null;

      // 3. Hamming distance matching on real images
      if (selectedPhoto && uploadedHash) {
        for (const c of (existing ?? [])) {
          // Check same category & location text matching
          const matchLoc = c.location_text?.toLowerCase().trim() === location.toLowerCase().trim();
          const matchCat = c.category === category;

          if (matchCat && matchLoc && c.photo_url) {
            // Compute the DB image hash
            const dbHash = await getImageHash(c.photo_url);
            const dist = getHammingDistance(uploadedHash, dbHash);

            // Hamming distance of <= 12 bits out of 64 indicates strong perceptual visual match!
            if (dist <= 12) {
              match = c;
              break;
            }
          }
        }
      }

      let finalDescription = description.trim();
      let finalPhotoUrl = selectedPhoto;

      if (match) {
        // Image de-duplication: Point to the existing photo_url, saving bucket/row storage!
        finalPhotoUrl = match.photo_url;
        // Mark as child complaint using [ML_MERGE:parent_uuid] signature
        finalDescription = `[ML_MERGE:${match.id}] ${finalDescription}`;
        setMlMatchMsg(`ML Perceptual Match (Hamming distance check): Reused existing image. Consolidated duplicate complaint!`);
        await new Promise(r => setTimeout(r, 1200));
      }

      // 4. Insert report
      const { error: insertError } = await supabase.from('complaints').insert({
        user_id: userId,
        title: title.trim(),
        description: finalDescription || null,
        category,
        location_text: location.trim() || null,
        department: deptMap[category],
        photo_url: finalPhotoUrl,
      });

      if (insertError) { setError(insertError.message); return; }

      await supabase.from('notifications').insert({
        user_id: userId,
        title: match ? 'Duplicate complaint merged' : 'Complaint filed',
        message: match 
          ? `Consolidated report filed for "${title.trim()}" at ${location.trim()}.`
          : `Your complaint "${title.trim()}" has been submitted.`,
        type: 'complaint',
      });

      setTitle(''); 
      setDescription(''); 
      setLocation(''); 
      setCategory('water');
      setSelectedPhoto(null);
      onCreated();
    } catch (e: any) {
      setError(e.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
      setMlAnalyzing(false);
      setMlMatchMsg(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="File a Complaint">
      <div className="space-y-4">
        {/* Category selector */}
        <div>
          <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  category === c.value ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-500'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Input label="Title" placeholder="e.g. Broken water pipe" value={title} onChange={setTitle} />
        <TextArea label="Description" placeholder="Describe the issue…" value={description} onChange={setDescription} />
        <Input label="Location" placeholder="e.g. Patrapada, Bhubaneswar" value={location} onChange={setLocation} />

        {/* Real Image Uploader */}
        <div>
          <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Upload Incident Photo</label>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {selectedPhoto ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-50 flex items-center justify-center group">
              <img src={selectedPhoto} alt="Upload Preview" className="w-full h-full object-cover" />
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-ink-200 rounded-2xl flex flex-col items-center gap-1.5 text-ink-400 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer"
            >
              <Camera className="w-6 h-6" />
              <span className="text-xs font-semibold text-slate-500">Tap to upload a real photo</span>
            </button>
          )}
        </div>

        {/* ML Status banner */}
        {mlAnalyzing && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl space-y-1">
            <p className="text-xs font-bold text-cyan-500 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
              CityZen ML Vision Engine Active
            </p>
            <p className="text-[10px] text-cyan-600">Extracting 64-bit perceptual visual hashes and running Hamming distance calculations against existing database issues...</p>
          </div>
        )}

        {mlMatchMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-xs font-bold text-emerald-500">🎉 {mlMatchMsg}</p>
          </div>
        )}

        {error && <div className="text-sm text-error-600 bg-error-500/10 rounded-xl px-4 py-2.5">{error}</div>}

        <Button onClick={handleSubmit} loading={submitting} size="lg" className="w-full">
          {mlAnalyzing ? 'Analyzing Image Similarity...' : 'Submit Complaint'}
        </Button>
      </div>
    </Modal>
  );
}

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const colors: Record<ComplaintStatus, string> = {
    submitted: 'bg-ink-100 text-ink-600',
    assigned: 'bg-secondary-100 text-secondary-700',
    in_progress: 'bg-accent-500/10 text-accent-600',
    resolved: 'bg-primary-100 text-primary-700',
    rejected: 'bg-error-500/10 text-error-600',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${colors[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function Input({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-500 mb-1.5 block">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/10 transition-all"
      />
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-500 mb-1.5 block">{label}</label>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/10 transition-all resize-none"
      />
    </div>
  );
}
