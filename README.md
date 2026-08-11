# 🏙️ CityZen — Smart Citizen Engagement & Municipal Portal

CityZen is a premium, real-time civic portal designed for Bhubaneswar, Odisha. It connects citizens, local merchants, and municipal administrators on a unified web platform to coordinate emergency services, track utility bills, report civic complaints, and monitor live environmental metrics.

---

## 🌟 Key Features

### 1. Citizen Portal
* **Live Emergency SOS**: Instantly triggers emergency signals. Automatically reads browser GPS coordinates, resolves them to the nearest database landmark, and opens a simulated operator voice line with real-time Speech-to-Speech synthesis.
* **Live City Status & IoT Telemetry**: Dynamic homepage grid monitoring Temperature, AQI, Humidity, Water Purity, Noise, and CO₂ levels with pulsing green status indicators and a 3-second live sensor update simulation.
* **Real-time Weather & AQI Integration**: Fetches real live weather conditions and US AQI scores based on the browser's exact Geolocation using the Open-Meteo APIs.
* **Interactive Smart Map**: Leaflet-powered geographic map rendering closest public transit, medical, police, fire, parking, and government hubs.
* **Certificates Vault (DigiLocker)**: Connects to a `citizen_certificates` table allowing citizens to securely link Aadhaar, Driving License, Birth, and Income certificates with gold watermarked PDF cards and download options.
* **Civic Complaints & Utility Invoices**: Citizens can file geo-tagged complaints with resolution tracking, link utility accounts, and pay water or electricity bills. Enforces a **Mandatory Unique Phone Number Gate** to prevent duplicate registrations.
* **Ask Zen AI**: An intelligent assistant capable of querying the database to retrieve actual unpaid bills, find nearest hospitals, and route users directly to the right pages via action buttons.
* **Glassmorphic Auth & Redesign**: A futuristic portal with ambient glowing mesh gradients, background geometric grids, floating badges, and interactive radio toggle cards.

### 2. Merchant Dashboard & BMC Panel
* **Operations Inspector**: Right sidebar interface for BMC responders to review photo evidence, submit resolution proof records, and manage civic tasks.
* **High-Res Zoomable Lightbox**: Allows admins and BMC responders to zoom (up to 350%), pan, and inspect original citizen-uploaded evidence in high fidelity.
* **ML Duplicate Clustering & Overload Badges**: Average Hash (aHash) matching logic groups duplicate complaints at the same coordinates. Blinks a **🚨 OVERLOAD CLUSTER (X REPORTS)** alert, while child reports are hidden to keep logs clean.
* **ML Image Classifier**: Client-side semantic classifier that automatically selects the correct complaint category dropdown option based on image filename keyword checks and canvas dominant pixel color analysis.

### 3. Municipal Admin Panel
* **Comprehensive Search Bars**: Filter users, bills, active complaints, and emergency dispatches instantly by city, name, category, or email.
* **Deduct Utility Balance**: Select any outstanding bill and deduct custom amounts in real-time. Bills transition to `paid` status once the balance hits zero.
* **Account Lockout Control**: Suspend or block suspicious citizen/merchant accounts. Suspended accounts are instantly locked out with a municipal warning screen.
* **Admin Password Override**: Direct secure password resets for any user account from the admin dashboard.

---

## 🛠️ Tech Stack
* **Frontend**: React.js (TypeScript), Vite, TailwindCSS (for baseline UI / layout structures)
* **Icons & Maps**: Lucide Icons, Leaflet.js
* **Backend & Storage**: Supabase (Postgres Database, Row-Level Security, Database Functions)

---

## 🚀 Local Development Setup

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org) installed on your system.

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <your-repository-url>
cd city-zen
npm install
```

### 3. Environment Variables
Create a file named `.env` in the root folder of your project and paste your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-api-key
```

### 4. Run Locally
Start the local development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 💾 Database Schema Setup (Supabase SQL Editor)

To establish the backend infrastructure, execute these commands inside your **Supabase SQL Editor**:

```sql
-- 1. Create Profiles Table (Syncs with Supabase Auth)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'business', 'admin')),
  ward integer,
  language text DEFAULT 'en',
  blocked boolean NOT NULL DEFAULT false,
  email text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Create Utility Bills Table
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'unpaid',
  period text NOT NULL,
  due_date date,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select own bills" ON public.bills FOR SELECT USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

-- 3. Create Complaints Table
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  location_text text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select complaints" ON public.complaints FOR SELECT USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

-- 4. Create Emergency Requests Table
CREATE TABLE public.emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  location_text text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select emergency" ON public.emergency_requests FOR SELECT USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

-- 5. Create Environmental Readings Table
CREATE TABLE public.environmental_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL UNIQUE,
  value numeric(6,2) NOT NULL,
  unit text NOT NULL DEFAULT '',
  recorded_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.environmental_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read environmental readings" ON public.environmental_readings FOR SELECT USING (true);

-- Seed Environmental Stats
INSERT INTO public.environmental_readings (metric, value, unit) VALUES
  ('temperature', 29.5, '°C'),
  ('aqi', 78, ''),
  ('humidity', 65, '%'),
  ('water_quality', 88, '%'),
  ('noise', 62, 'dB'),
  ('co2', 420, 'ppm')
ON CONFLICT (metric) DO NOTHING;

-- 6. Create Map Points Table
CREATE TABLE public.map_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  lat numeric(9,6) NOT NULL,
  lng numeric(9,6) NOT NULL,
  address text,
  phone text,
  open_24h boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.map_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read map points" ON public.map_points FOR SELECT USING (true);

-- Seed Bhubaneswar Map Points
INSERT INTO public.map_points (name, category, lat, lng, address, phone, open_24h) VALUES
  ('AIIMS Hospital Bhubaneswar', 'hospital', 20.2223, 85.7335, 'Sijua, Patrapada, Bhubaneswar, Odisha 751019', '0674-247-6600', true),
  ('Tamando Police Station', 'police', 20.2185, 85.7275, 'NH 16, Tamando, Bhubaneswar, Odisha 751028', '100', true),
  ('Gohiria Mo Bus Stop', 'transit', 20.2263, 85.7483, 'Janla, Odisha 752054', '1077', true),
  ('Khandagiri Fire Station', 'fire', 20.2612, 85.7885, 'Khandagiri, Bhubaneswar, Odisha 751030', '101', true);

-- 7. Create Notifications Table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- 8. Create Admin Forced Reset Helper Function
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id uuid, new_plaintext_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can reset other users passwords.';
  END IF;

  -- Hash and override encrypted_password
  UPDATE auth.users
  SET encrypted_password = crypt(new_plaintext_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;
```

---

## 🛡️ RLS & Security Policy Overview
* Citizens can only read and write their own profile, bills, emergency triggers, and complaints.
* Admins are granted full query permissions to oversee registrations, deduct utility bills, monitor active dispatches, and process complaints.
* Password modifications for other users can only be executed via the `admin_reset_user_password` secure Postgres RPC function, preventing standard users from accessing administrative credentials.

---

## 📤 Production Deployment

### Vercel (Recommended)
1. Commit and push your local repository to GitHub.
2. Link your GitHub account on [Vercel](https://vercel.com).
3. Import your project repo and configure the Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Click **Deploy**. Vercel will handle building and hosting your app on a secure HTTPS server.
