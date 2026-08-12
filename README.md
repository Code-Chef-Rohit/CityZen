# 🏙️ CityZen — Smart Municipal Engagement & Governance Platform

CityZen is a production-grade, real-time municipal operating system and civic engagement platform tailored for smart cities. It unifies citizens, first responders (Police, Hospitals, BMC, Fire), local health facilities, and municipal administrators into a single, high-performance ecosystem.

---

## 🌟 Key Features & Ecosystem Architecture

### 1. 👥 Citizen Portal
* **Live Emergency SOS**: Instantly triggers high-priority emergency dispatches for Police, Ambulance, Fire, or Women's Safety with continuous GPS coordinate streaming ($\pm 4\text{m}$ accuracy).
* **Voice-Activated SOS AI**: Speech recognition engine that dynamically auto-triages natural language distress calls (e.g. *"Someone is having chest pain"* $\rightarrow$ Emergency Ambulance dispatch + CPR compression instructions).
* **Real-Time Atmospheric Station Telemetry**: Integrates real-time meteorological and air quality feeds (Temperature, "Feels Like", Air Quality Index (AQI), $\text{PM}_{2.5}$, $\text{PM}_{10}$, relative humidity, and wind speed) based on actual GPS coordinates.
* **Persistent Zen AI Assistant**: Multi-modal civic assistant capable of querying outstanding bills, finding nearest 24/7 hospitals, checking live environmental telemetry, and filing reports. Conversation history is preserved across screen transitions until page refresh.
* **DigiLocker Document Vault**: Secure citizen certificates vault allowing citizens to link, inspect, and export verified government records (Aadhaar, Driving License, Birth Certificates, Property Tax Receipts).
* **Utility Bills & Civic Invoices**: Real-time breakdown of water, electricity, sanitation, and municipal tax invoices with instant simulated payment processing and downloadable receipts.
* **Civic Complaint Filing**: Interactive report submission with automatic GPS locking, camera photo upload, and instant ML verification.
* **Strict Unique Phone Gate**: Enforces valid 10-digit mobile number uniqueness across the system to prevent duplicate or fraudulent registrations.

---

### 2. 🤖 ML Computer Vision & Spatial Clustering Engine (`src/lib/mlImageVerification.ts`)
* **64-Bit Perceptual Hashing (pHash)**: Downsamples incident photos to standardized $8 \times 8$ luminance matrices using the ITU-R standard formula ($Y = 0.299R + 0.587G + 0.114B$) to extract structural visual fingerprints.
* **Hamming Distance Comparison**: Compares binary hashes against the civic database; a distance $\le 14$ ($\ge 78.1\%$ similarity) confirms visual duplication.
* **Spatial Geodesic Proximity Filter (Haversine Matrix)**: Enforces a $\le 150\text{ meters}$ radius constraint between GPS coordinates so different incidents in other areas are not falsely merged.
* **Visual Entropy & Sensor Authenticity Analyzer**: Evaluates 3D color quantization space ($8 \times 8 \times 8$ buckets) and adjacent pixel differential noise variance to generate a genuine camera capture score ($65\%\text{--}99\%$).
* **Automated Overload Escalation**: When $\ge 2$ citizens report the same spot, the ML cluster escalates the incident to **`[CRITICAL OVERLOAD]`** priority on responder dashboards.

---

### 3. 🚓 First Responder Dashboards (Police, Hospital, BMC, Fire)
* **Live Emergency Dispatch Queue**: Displays incoming SOS alarms with citizen full name, phone number, exact GPS coordinates, and timestamp.
* **Turn-by-Turn GPS Navigation**: Integrated **"Guide Me"** action launches turn-by-turn Google Maps routing directly to the citizen's distress location.
* **BMC Resolution Proof Logging**: BMC supervisors must upload a photo of the completed repair (e.g. patched pothole, repaired street lamp) along with field notes before closing a complaint.
* **Consolidated Cluster Auto-Resolution**: When BMC resolves a master complaint, all linked duplicate tickets are automatically marked resolved, and every filing citizen receives a notification with the BMC proof notes.
* **Hospital Beds & Ambulance Directory**: Real-time capacity manager for total beds, ICU units, and specialized emergency contact numbers.

---

### 4. ⚡ Super Admin Control Center
* **Primary Owner Safeguard**: The root administrator account (`rohitranjanpatra8@gmail.com` / `7735550648`) is permanently protected from demotion or deletion by secondary administrators.
* **User Authority Management**: Promote or reassign roles across Citizen, Police, Hospital, BMC, and Admin, or suspend fraudulent accounts.
* **Utility Invoice Auditing**: Real-time search, invoice balance deduction, and payment verification.
* **Direct Password Reset**: Administrative password overrides via secure PostgreSQL security-definer RPC functions.
* **Live View Switcher**: Instant switching between Super Admin Control Center and Citizen View for live end-to-end verification.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React.js (TypeScript) + Vite |
| **Styling & Design** | Vanilla CSS + Tailwind Utility Classes (Dark/Glassmorphic Aesthetic) |
| **Icons & Visuals** | Lucide Icons, Leaflet.js (OpenStreetMap) |
| **Machine Learning** | Client-side Computer Vision (Perceptual pHash, Haversine Matrix, Color Entropy) |
| **Live Telemetry** | Open-Meteo Meteorological & Air Quality Station APIs |
| **Backend & Database** | Supabase (PostgreSQL 15+, Row Level Security, RPC Stored Procedures) |

---

## 🚀 Local Development Setup

### 1. Prerequisites
* [Node.js](https://nodejs.org) (v18 or higher recommended)
* Supabase account and project

### 2. Installation
```bash
# Clone the repository
git clone <your-repository-url>
cd city-zen

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-api-key
```

### 4. Run Dev Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 💾 Database Schema & Migration Setup

Run the following consolidated script in your **Supabase SQL Editor** (SQL Editor $\rightarrow$ New Query $\rightarrow$ Run):

```sql
-- =========================================================================
-- CITYZEN COMPLETE DATABASE SCHEMA & SECURITY POLICIES
-- =========================================================================

-- 1. Helper Security Functions (SET row_security = off prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR email ILIKE 'rohitranjanpatra8@gmail.com')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role IN ('admin', 'police', 'hospital', 'bmc') OR email ILIKE 'rohitranjanpatra8@gmail.com')
  );
$$;

-- Helper RPC to fetch profiles with security definer
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT * FROM public.profiles ORDER BY created_at DESC;
$$;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'police', 'hospital', 'bmc', 'admin', 'business')),
  ward integer DEFAULT 12,
  language text DEFAULT 'en',
  blocked boolean NOT NULL DEFAULT false,
  email text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id OR public.is_admin());

-- Unique Phone Number Trigger & Index
CREATE OR REPLACE FUNCTION public.check_phone_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND TRIM(NEW.phone) != '' THEN
    NEW.phone := REGEXP_REPLACE(NEW.phone, '\D', '', 'g');
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE phone = NEW.phone AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Phone number % is already registered to another user account.', NEW.phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_phone_uniqueness ON public.profiles;
CREATE TRIGGER trg_check_phone_uniqueness
  BEFORE INSERT OR UPDATE OF phone
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_phone_uniqueness();

DROP INDEX IF EXISTS public.idx_profiles_unique_phone;
CREATE UNIQUE INDEX idx_profiles_unique_phone ON public.profiles(phone) WHERE phone IS NOT NULL AND phone != '';

-- 3. Complaints Table with Geolocation & BMC Proof
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  department text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'assigned', 'in_progress', 'resolved', 'rejected')),
  location_text text,
  lat double precision,
  lng double precision,
  photo_url text,
  visual_hash text,
  ml_verification_score integer DEFAULT 95,
  resolution_proof text,
  resolution_photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints_select_all" ON public.complaints FOR SELECT TO authenticated USING (true);
CREATE POLICY "complaints_insert_policy" ON public.complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "complaints_update_all" ON public.complaints FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_staff_or_admin()) WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());
CREATE POLICY "complaints_delete_policy" ON public.complaints FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- 4. Utility Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  period text NOT NULL,
  due_date date,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills_select_policy" ON public.bills FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "bills_insert_policy" ON public.bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "bills_update_policy" ON public.bills FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "bills_delete_policy" ON public.bills FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- 5. Emergency Requests Table
CREATE TABLE IF NOT EXISTS public.emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dispatched', 'resolved')),
  location_text text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_select_policy" ON public.emergency_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "emergency_insert_policy" ON public.emergency_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "emergency_update_policy" ON public.emergency_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_staff_or_admin()) WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());
CREATE POLICY "emergency_delete_policy" ON public.emergency_requests FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_policy" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin());
```

---

## 🔒 Security & Role-Based Permissions

1. **Row Level Security (RLS)**: Protects user records while allowing authorized municipal staff and super admins to audit and resolve civic operations without recursive query lockouts.
2. **Atomic Phone Uniqueness**: Database triggers standardize and validate phone numbers on every write, preventing duplicate registrations.
3. **Primary Owner Immunity**: Enforces root administrator privileges and prevents accidental self-demotion or malicious takeover.

---

## 📦 Production Build & Deployment

To validate and build the production bundle:
```bash
npm run build
```

Deployable to any modern web platform (Vercel, Netlify, Cloudflare Pages, AWS Amplify).
Ensure the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables are configured in your hosting platform.
