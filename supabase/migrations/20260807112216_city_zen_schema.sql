/*
# CITY ZEN — Core Citizen App Schema

## Overview
Creates the database backend for the CITY ZEN citizen app: a multi-user app where
citizens sign in, file complaints, pay bills, trigger emergency SOS, receive
notifications, and browse city services on a smart map.

## New Tables

### Auth-scoped (owner = signed-in citizen)
- `profiles` — extends auth.users with civic profile data.
  - `id` (uuid, PK, FK to auth.users), `full_name`, `phone`, `role` (citizen|business|admin),
    `language` (en|hi|ta|te|mr|bn), `ward` (city ward number), `avatar_url`, `created_at`.
- `complaints` — citizen-filed complaints tracked through a status lifecycle.
  - `id`, `user_id`, `title`, `description`, `category` (water|electricity|waste|roads|streetlight|other),
    `status` (submitted|assigned|in_progress|resolved|rejected), `department`, `location_text`,
    `photo_url`, `created_at`, `updated_at`, `resolved_at`.
- `bills` — utility bills owed by a citizen.
  - `id`, `user_id`, `type` (water|electricity|property|waste), `amount` (numeric),
    `due_date`, `period` (e.g. "Aug 2026"), `status` (unpaid|paid), `paid_at`, `created_at`.
- `emergency_requests` — SOS incidents raised by a citizen.
  - `id`, `user_id`, `type` (police|ambulance|fire|disaster), `status` (active|dispatched|resolved),
    `location_text`, `notes`, `created_at`, `resolved_at`.
- `notifications` — per-user notifications.
  - `id`, `user_id`, `title`, `message`, `type` (emergency|government|bill|complaint|traffic|ai),
    `read` (boolean), `created_at`.

### Public reference data (read by anon + authenticated)
- `services` — catalog of city services shown in Explore.
  - `id`, `category`, `name`, `description`, `icon` (lucide icon name), `available` (boolean).
- `map_points` — points of interest on the Smart Map.
  - `id`, `name`, `category` (hospital|police|fire|parking|government|pharmacy|park|transit),
    `lat` (numeric), `lng` (numeric), `address`, `phone`, `open_24h` (boolean).
- `environmental_readings` — latest environmental metrics for the dashboard.
  - `id`, `metric` (aqi|temperature|co2|noise|water_quality|green_coverage), `value` (numeric),
    `unit`, `recorded_at`.

## Security (RLS)
- All auth-scoped tables: owner-scoped CRUD via `auth.uid() = user_id`. Owner columns
  default to `auth.uid()` so inserts that omit `user_id` still satisfy WITH CHECK.
- `profiles`: user can read/update only their own row.
- Public reference tables (`services`, `map_points`, `environmental_readings`): read by
  anon + authenticated (intentionally public); writes restricted to authenticated (service
  catalog is seeded, not user-editable in the citizen app).

## Notes
1. Email confirmation stays OFF (default).
2. All policies are idempotent (DROP POLICY IF EXISTS before CREATE).
3. Indexes added on frequently-filtered columns (user_id, category, status).
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen','business','admin')),
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi','ta','te','mr','bn')),
  ward integer,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- COMPLAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('water','electricity','waste','roads','streetlight','other')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','assigned','in_progress','resolved','rejected')),
  department text,
  location_text text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

DROP POLICY IF EXISTS "select_own_complaints" ON complaints;
CREATE POLICY "select_own_complaints" ON complaints FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_complaints" ON complaints;
CREATE POLICY "insert_own_complaints" ON complaints FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_complaints" ON complaints;
CREATE POLICY "update_own_complaints" ON complaints FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_complaints" ON complaints;
CREATE POLICY "delete_own_complaints" ON complaints FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- BILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('water','electricity','property','waste')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  period text,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

DROP POLICY IF EXISTS "select_own_bills" ON bills;
CREATE POLICY "select_own_bills" ON bills FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_bills" ON bills;
CREATE POLICY "insert_own_bills" ON bills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_bills" ON bills;
CREATE POLICY "update_own_bills" ON bills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_bills" ON bills;
CREATE POLICY "delete_own_bills" ON bills FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- EMERGENCY REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('police','ambulance','fire','disaster')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','dispatched','resolved')),
  location_text text,
  notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_emergency_user ON emergency_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_requests(status);

DROP POLICY IF EXISTS "select_own_emergency" ON emergency_requests;
CREATE POLICY "select_own_emergency" ON emergency_requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_emergency" ON emergency_requests;
CREATE POLICY "insert_own_emergency" ON emergency_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_emergency" ON emergency_requests;
CREATE POLICY "update_own_emergency" ON emergency_requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_emergency" ON emergency_requests;
CREATE POLICY "delete_own_emergency" ON emergency_requests FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'government' CHECK (type IN ('emergency','government','bill','complaint','traffic','ai')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SERVICES (public reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'Circle',
  available boolean NOT NULL DEFAULT true
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_services_all" ON services;
CREATE POLICY "read_services_all" ON services FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- MAP POINTS (public reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS map_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('hospital','police','fire','parking','government','pharmacy','park','transit')),
  lat numeric(9,6) NOT NULL,
  lng numeric(9,6) NOT NULL,
  address text,
  phone text,
  open_24h boolean NOT NULL DEFAULT false
);
ALTER TABLE map_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_map_points_all" ON map_points;
CREATE POLICY "read_map_points_all" ON map_points FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- ENVIRONMENTAL READINGS (public reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS environmental_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL CHECK (metric IN ('aqi','temperature','co2','noise','water_quality','green_coverage')),
  value numeric(10,2) NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz DEFAULT now()
);
ALTER TABLE environmental_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_env_all" ON environmental_readings;
CREATE POLICY "read_env_all" ON environmental_readings FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- SEED: SERVICES
-- ============================================================
INSERT INTO services (category, name, description, icon, available) VALUES
  ('Utilities','Water Services','View supply schedule, report leakages, pay bills','Droplets',true),
  ('Utilities','Electricity','Outage alerts, consumption, solar, bills','Zap',true),
  ('Utilities','Waste Management','Pickup schedule, smart bins, complaints','Trash2',true),
  ('Transport','Public Transport','Live bus routes, stops, timetables','Bus',true),
  ('Transport','Parking','Find and reserve parking spots','SquareParking',true),
  ('Transport','Traffic','Live traffic conditions and routes','Car',true),
  ('Healthcare','Hospitals','Find nearest hospitals and clinics','Building2',true),
  ('Healthcare','Pharmacy','Locate 24x7 pharmacies','Pill',true),
  ('Healthcare','Blood Bank','Blood availability and donation','HeartPulse',true),
  ('Government','Certificates','Birth, death, income certificates','FileText',true),
  ('Government','Permits & Licenses','Apply and track applications','ScrollText',true),
  ('Government','Property Tax','Assess and pay property tax','Landmark',true),
  ('Government','Construction','View civic projects and progress','HardHat',true),
  ('Property','Property Search','AI-powered property listings','Home',true),
  ('Emergency','SOS','One-tap emergency dispatch','Siren',true),
  ('Emergency','Police','Nearest police stations','Shield',true),
  ('Environment','Air Quality','Live AQI and sustainability score','Leaf',true),
  ('Complaints','File Complaint','Report civic issues with photo and location','MessageSquareWarning',true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: MAP POINTS (around a representative city center)
-- ============================================================
INSERT INTO map_points (name, category, lat, lng, address, phone, open_24h) VALUES
  ('City General Hospital','hospital',12.9716,77.5946,'MG Road, Bengaluru','080-2200-1000',true),
  ('Sunrise Children''s Clinic','hospital',12.9352,77.6245,'Indiranagar','080-2200-2000',false),
  ('Central Police Station','police',12.9750,77.6050,'Commercial Street','100',true),
  ('Indiranagar Police Outpost','police',12.9719,77.6412,'100 Feet Road','100',true),
  ('Fire Station Brigade Rd','fire',12.9762,77.6033,'Brigade Road','101',true),
  ('MG Road Multi-level Parking','parking',12.9756,77.6060,'MG Road','080-2200-3000',false),
  ('City Corporation Office','government',12.9760,77.5990,'Corp Office','080-2200-4000',false),
  ('RTO Office Ward 12','government',12.9600,77.6100,'Shivaji Nagar','080-2200-5000',false),
  ('Apollo Pharmacy','pharmacy',12.9700,77.6150,'Koramangala','080-2200-6000',true),
  ('Wellness Forever','pharmacy',12.9400,77.6200,'Indiranagar','080-2200-7000',true),
  ('Cubbon Park','park',12.9762,77.5929,'Cubbon Road','080-2200-8000',true),
  ('Lalbagh Botanical Garden','park',12.9500,77.5850,'Basavanagudi','080-2200-9000',false),
  ('Kempegowda Bus Terminal','transit',12.9700,77.5700,'Majestic','080-2200-1100',true),
  ('Metro Station Purple Line','transit',12.9750,77.5990,'MG Road','080-2200-1200',true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: ENVIRONMENTAL READINGS
-- ============================================================
INSERT INTO environmental_readings (metric, value, unit) VALUES
  ('aqi',78,'AQI'),
  ('temperature',29.5,'°C'),
  ('co2',420,'ppm'),
  ('noise',62,'dB'),
  ('water_quality',88,'%'),
  ('green_coverage',34,'%')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'phone',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
