# 🏙️ CityZen — Smart Municipal Engagement & Governance Platform

[![Live Web Application](https://img.shields.io/badge/Netlify_App-Live_Production-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://cityzen-one.netlify.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15+-Read_Replica_Cluster-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

> 🌐 **Live Production Portal:** [https://cityzen-one.netlify.app/](https://cityzen-one.netlify.app/)

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
* **3-Day Anti-Churn Deletion Restriction**: Enforces a strict 3-day restriction period after account creation during which deletion is blocked to prevent fraudulent identity manipulation.
* **7-Day Grace Period Scheduled Deletion**: Once eligible, deletion enters a mandatory 7-day waiting period. Citizens receive an official confirmation email, view live countdown telemetry on their profile, and can cancel the request at any time with one click.

---

### 2. 🤖 ML Computer Vision & Spatial Clustering Engine (`src/lib/mlImageVerification.ts`)
* **64-Bit Perceptual Hashing (pHash)**: Downsamples incident photos to standardized $8 \times 8$ luminance matrices using the ITU-R standard formula ($Y = 0.299R + 0.587G + 0.114B$) to extract structural visual fingerprints.
* **Hamming Distance Comparison**: Compares binary hashes against the civic database; a distance $\le 14$ ($\ge 78.1\%$ similarity) confirms visual duplication.
* **Spatial Geodesic Proximity Filter (Haversine Matrix)**: Enforces a $\le 150\text{ meters}$ radius constraint between GPS coordinates so different incidents in other areas are not falsely merged.
* **Visual Entropy & Sensor Authenticity Analyzer**: Evaluates 3D color quantization space ($8 \times 8 \times 8$ buckets) and adjacent pixel differential noise variance to generate a genuine camera capture score ($65\%\text{--}99\%$).
* **Zen AI Feedforward Neural Network (MLP Intent Classifier - `src/lib/zenAiNeuralNetwork.ts`)**: Multilayer Perceptron featuring a 120-dimensional Bag-of-Words feature vectorizer, 32-neuron ReLU hidden layer, and Softmax probability evaluator $P(\text{Intent}_i | \text{Query})$ across 10 municipal categories with confidence scoring (e.g. `98% Confidence`).

---

### 3. 🚓 First Responder Dashboards (Police, Hospital, BMC, Fire)
* **Live Emergency Dispatch Queue**: Displays incoming SOS alarms with citizen full name, phone number, exact GPS coordinates, and timestamp.
* **Turn-by-Turn GPS Navigation**: Integrated **"Guide Me"** action launches turn-by-turn Google Maps routing directly to the citizen's distress location.
* **BMC Resolution Proof Logging**: BMC supervisors must upload a photo of the completed repair (e.g. patched pothole, repaired street lamp) along with field notes before closing a complaint.
* **Consolidated Cluster Auto-Resolution**: When BMC resolves a master complaint, all linked duplicate tickets are automatically marked resolved, and every filing citizen receives an automated official email and in-app notice with BMC proof notes.
* **Hospital Beds & Ambulance Directory**: Real-time capacity manager for total beds, ICU units, and specialized emergency contact numbers.

---

### 4. ⚡ Super Admin Control Center
* **Primary Owner Safeguard**: The root administrator account (`rohitranjanpatra8@gmail.com` / `7735550648`) is permanently protected from demotion or deletion by secondary administrators.
* **User Authority Management**: Promote or reassign roles across Citizen, Police, Hospital, BMC, and Admin with automatic background EmailJS dispatch.
* **Automated Municipal Email Gateway**: Background SMTP relay with custom official communiqué styling (`Sender: CityZen Admin`, Subject format `[OFFICIAL NOTICE] CityZen Admin Update: [NEW ROLE] Clearance Granted`, reference number, role designation, authorized capabilities & login link).
* **Account Deletion Telemetry & Timing Modification**: Super Administrators can view user deletion requests in real time, inspect remaining grace periods, and adjust or reschedule execution dates (`+1d`, `+3d`, `+7d`, `+14d`, custom datetime-local) or revoke deletion requests.
* **Super Admin Immediate Deletion Override**: Super Administrators have direct authority to immediately delete any account on the spot, bypassing the 7-day waiting period.
* **Utility Invoice Auditing**: Real-time search, invoice balance deduction, and payment verification with automated citizen receipts.
* **Direct Password Reset**: Administrative password overrides via secure PostgreSQL security-definer RPC functions.
* **Live View Switcher**: Instant switching between Super Admin Control Center and Citizen View for live end-to-end verification.

---

### 5. 🗄️ High-Availability Read Replica & Read/Write Splitting Cluster (`src/lib/databaseReplicaRouter.ts`)
* **Transparent Query Splitting**: Smart proxy architecture automatically routes read operations (`.select()`) to the dedicated Read Replica pool (with round-robin load distribution across multiple replicas), while routing write operations (`.insert()`, `.update()`, `.delete()`, `.upsert()`) directly to the Primary Write Leader.
* **Zero Breaking Changes**: Works seamlessly across all 89+ database queries throughout the entire application without modifying existing code.
* **Circuit-Breaker & Automatic Failover**: If a read replica fails, times out, or encounters a 5xx error, the router automatically replays the exact chained query on the Primary Leader with zero downtime and no client-side exceptions. Degraded nodes automatically enter a 30-second cooldown period before re-probing.
* **JWT Session Propagation**: Uses custom `global.fetch` inside replica clients to pass the active user session token (`Authorization: Bearer <Token>`) from `primaryClient.auth.getSession()`, guaranteeing that all Row-Level Security (RLS) policies work identically on both Primary and Replicas.
* **PostgreSQL WAL Replication Diagnostics RPC (`supabase/migrations/20261017150000_database_read_replica_diagnostics.sql`)**: Stored procedure `get_database_replication_status()` returns node role (`primary_leader` vs `read_replica`), active WAL LSN positions (`pg_current_wal_lsn` / `pg_last_wal_replay_lsn`), streaming replication lag from `pg_stat_replication`, database size, and active connections.
* **Admin Cluster & Replica Monitoring Console**: Dedicated **"Cluster & Replicas"** tab in the Admin Dashboard featuring live cluster topology cards, interactive latency benchmarking tool (`testClusterLatency`), traffic split ratios (% Read vs % Write), failover counters, a live 30-query routing log, and dynamic replica URL testing.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React.js (TypeScript) + Vite |
| **Styling & Design** | Vanilla CSS + Tailwind Utility Classes (Dark/Glassmorphic Aesthetic) |
| **Icons & Visuals** | Lucide Icons, Leaflet.js (OpenStreetMap) |
| **Machine Learning** | Client-side Computer Vision (Perceptual pHash, Haversine Matrix, Color Entropy) |
| **Live Telemetry** | Open-Meteo Meteorological & Air Quality Station APIs |
| **Backend & Database** | Supabase (PostgreSQL 15+, Transparent Read/Write Replica Splitting, Circuit-Breaker Failover, Row Level Security, RPC Stored Procedures) |

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
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
# Primary Leader (Writes, Auth, Storage, Realtime)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-api-key

# Dedicated Read Replica (or comma-separated list of replica endpoints)
# If left matching VITE_SUPABASE_URL or omitted, runs in Primary Combined Mode
VITE_SUPABASE_READ_REPLICA_URL=https://your-project-id.supabase.co
```

### 4. Run Dev Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 🔄 Preventing Supabase 7-Day Auto-Pause (Free Tier Keep-Alive)

Supabase Free Tier projects auto-pause after **7 days of zero API activity**. To keep your project running 24/7 indefinitely:

1. **Automated GitHub Action Workflow** (Included):
   - We included a workflow file at [`.github/workflows/supabase-keepalive.yml`](file:///.github/workflows/supabase-keepalive.yml).
   - Once you push this repo to GitHub, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to **GitHub Repo Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**.
   - GitHub Actions will run automatically every **3 days** to send a light query to Supabase, keeping the project active forever!

2. **Local / Manual Ping Command**:
   ```bash
   npm run keep-alive
   ```

3. **External Free Monitoring (e.g. UptimeRobot or Cron-Job.org)**:
   - Create a free monitor pointing to `https://<YOUR-SUPABASE-ID>.supabase.co/rest/v1/profiles?select=id&limit=1`
   - Add HTTP headers:
     - `apikey`: `YOUR_ANON_KEY`
     - `Authorization`: `Bearer YOUR_ANON_KEY`
   - Set monitor interval to every 1–3 days.

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
  deletion_requested_at timestamp with time zone,
  deletion_scheduled_at timestamp with time zone,
  deletion_status text CHECK (deletion_status IN ('scheduled', 'cancelled', 'executed')),
  deletion_reason text,
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

## 🔒 Security & Lifecycle Governance Policies

1. **Row Level Security (RLS)**: Protects user records while allowing authorized municipal staff and super admins to audit and resolve civic operations without recursive query lockouts.
2. **Atomic Phone Uniqueness**: Database triggers standardize and validate phone numbers on every write, preventing duplicate registrations.
3. **Primary Owner Immunity**: Enforces root administrator privileges (`rohitranjanpatra8@gmail.com` / `7735550648`) and prevents accidental self-demotion or malicious takeover.
4. **3-Day Anti-Churn Registration Lock**: Newly opened accounts cannot be deleted within 3 days of creation. Prevents malicious churn, spam cycles, and volatile identity manipulation.
5. **7-Day Grace Period Scheduled Deletion**: Once past the 3-day lock, deletion enters a mandatory 7-day waiting period. Citizens receive automated official confirmation emails, view real-time countdown telemetry on their profile, and can cancel the request with one click.
6. **Super Administrator Immediate Purge Override**: Super Admins possess direct override capabilities to immediately purge accounts and associated records without waiting.
7. **Admin Timing Telemetry & Rescheduling**: Super Admins can audit all scheduled deletions, view exact requested timestamps and remaining grace periods, and modify or reschedule execution timing (`+1d`, `+3d`, `+7d`, `+14d`, custom datetime-local) with automated citizen email notifications.
8. **Enterprise Read/Write Isolation & Failover Guarantee**: Read traffic is isolated from write workloads, protecting transactional operations (e.g. SOS alerts, payments, grievance submissions) from heavy read contention. In the event of replica degradation, queries automatically fail over to the primary leader without user disruption.

---

## 🗄️ Database Clustering & Read Replica Setup Guide

CityZen features built-in support for dedicated Supabase/PostgreSQL Read Replicas:

### 1. Provisioning a Read Replica in Supabase Cloud
1. Navigate to your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Go to **Settings** $\rightarrow$ **Database** $\rightarrow$ **Read Replicas**.
3. Click **Deploy Read Replica** and select your closest AWS region (e.g. `ap-south-1` for Mumbai).
4. Copy the assigned Read Replica URL.

### 2. Attaching to CityZen
You can attach the replica in two ways:
* **Option A (Environment File)**: Set `VITE_SUPABASE_READ_REPLICA_URL=<Replica-URL>` in your `.env` file.
* **Option B (Admin Dashboard)**: Open the **Cluster & Replicas** tab in the Super Admin Dashboard and enter the URL in the **Connect Dedicated Cloud Read Replica** field.

### 3. PostgreSQL Replication Diagnostics
Run the diagnostic migration located at:
[`supabase/migrations/20261017150000_database_read_replica_diagnostics.sql`](file:///supabase/migrations/20261017150000_database_read_replica_diagnostics.sql)
in your Supabase SQL Editor. This enables the Super Admin Dashboard to inspect live WAL positions, database size, and streaming replication lag in real time.

---

## 📧 Automated Municipal Email Gateway

CityZen incorporates an automated background email dispatch engine using **EmailJS SMTP relay**:

* **Service ID**: `service_xlxsj8f`
* **Template ID**: `template_bnczuvh`
* **Public Key**: `l8ZDaCW7jP2JEQfDN`
* **Automated Official Notice Formatting**:
  * **Sender**: `CityZen Admin`
  * **Subject**: `[OFFICIAL NOTICE] CityZen Admin Update: [NEW ROLE] Clearance Granted`
  * **Content Architecture**:
    * Official Communiqué Ref Number & Date (e.g. `BMC/CZ-AUTH/2026/08-XXXXXX`)
    * New Assigned Role & Designation (e.g. `Super Administrator`, `Law Enforcement Dispatcher`, etc.)
    * Authorized Capabilities & Operational Permissions
    * Direct Secure Login Link to CityZen Portal
* **Automated Across All Municipal Personas**: Grievance status resolutions, utility bill payments & deductions, emergency SOS closures, and account deletion schedules dispatch instantly in the background without opening external mail clients.

---

## 📦 Production Build & Deployment

### 1. Web Production Build (Netlify / Cloud Platforms)
```bash
npm run build
```
The application is live and hosted at:
> 🌐 **Production URL:** [https://cityzen-one.netlify.app/](https://cityzen-one.netlify.app/)

### 2. Desktop Application Synchronized Build
To compile TypeScript, build the web distribution, and automatically sync to the local desktop application:
```bash
npm run build:desktop
```
*(Automatically syncs production assets directly to `C:\Users\SAMSUNG\OneDrive\Desktop\CityZen App`)*.
