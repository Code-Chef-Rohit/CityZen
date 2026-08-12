-- Master Migration: Comprehensive RLS Policy Fix for Admin & Municipal Responders
-- Run this in your Supabase SQL Editor to grant Admin full visibility and control across all tables.

-- 1. Helper security definer functions to prevent infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
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
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role IN ('admin', 'police', 'hospital', 'bmc') OR email ILIKE 'rohitranjanpatra8@gmail.com')
  );
$$;

-- 2. PROFILES TABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "allow_admins_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

-- Allow all authenticated users to read profiles (needed for complaint lists, responder details, and admin panel)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Allow inserting own profile or admin inserting
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Allow updating own profile or admin updating any profile
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Allow deleting profile (admin or owner)
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id OR public.is_admin());


-- 3. COMPLAINTS TABLE RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_complaints" ON public.complaints;
DROP POLICY IF EXISTS "complaints_select_all" ON public.complaints;
DROP POLICY IF EXISTS "insert_own_complaints" ON public.complaints;
DROP POLICY IF EXISTS "complaints_insert_policy" ON public.complaints;
DROP POLICY IF EXISTS "update_own_complaints" ON public.complaints;
DROP POLICY IF EXISTS "complaints_update_all" ON public.complaints;
DROP POLICY IF EXISTS "delete_own_complaints" ON public.complaints;
DROP POLICY IF EXISTS "complaints_delete_policy" ON public.complaints;

-- Allow all authenticated users to read complaints (public civic feed + admin + staff)
CREATE POLICY "complaints_select_all" ON public.complaints
  FOR SELECT TO authenticated
  USING (true);

-- Allow creating complaint
CREATE POLICY "complaints_insert_policy" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Allow updating complaint (creator, BMC/police/hospital staff, or admin)
CREATE POLICY "complaints_update_all" ON public.complaints
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());

-- Allow deleting complaint (creator or admin)
CREATE POLICY "complaints_delete_policy" ON public.complaints
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());


-- 4. BILLS TABLE RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bills" ON public.bills;
DROP POLICY IF EXISTS "bills_select_policy" ON public.bills;
DROP POLICY IF EXISTS "insert_own_bills" ON public.bills;
DROP POLICY IF EXISTS "bills_insert_policy" ON public.bills;
DROP POLICY IF EXISTS "update_own_bills" ON public.bills;
DROP POLICY IF EXISTS "bills_update_policy" ON public.bills;
DROP POLICY IF EXISTS "delete_own_bills" ON public.bills;
DROP POLICY IF EXISTS "bills_delete_policy" ON public.bills;

-- Allow citizen to read own bills, or admin to read all city bills
CREATE POLICY "bills_select_policy" ON public.bills
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Allow citizen or admin to insert bills
CREATE POLICY "bills_insert_policy" ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Allow citizen or admin to update bills (e.g. mark paid, deduct)
CREATE POLICY "bills_update_policy" ON public.bills
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Allow deleting bills (creator or admin)
CREATE POLICY "bills_delete_policy" ON public.bills
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());


-- 5. EMERGENCY REQUESTS TABLE RLS
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_emergency" ON public.emergency_requests;
DROP POLICY IF EXISTS "emergency_select_policy" ON public.emergency_requests;
DROP POLICY IF EXISTS "insert_own_emergency" ON public.emergency_requests;
DROP POLICY IF EXISTS "emergency_insert_policy" ON public.emergency_requests;
DROP POLICY IF EXISTS "update_own_emergency" ON public.emergency_requests;
DROP POLICY IF EXISTS "emergency_update_policy" ON public.emergency_requests;
DROP POLICY IF EXISTS "delete_own_emergency" ON public.emergency_requests;
DROP POLICY IF EXISTS "emergency_delete_policy" ON public.emergency_requests;

-- Allow reading emergency requests (citizen + police + hospital + fire + admin)
CREATE POLICY "emergency_select_policy" ON public.emergency_requests
  FOR SELECT TO authenticated
  USING (true);

-- Allow creating emergency request
CREATE POLICY "emergency_insert_policy" ON public.emergency_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Allow updating emergency request (staff status change + citizen + admin)
CREATE POLICY "emergency_update_policy" ON public.emergency_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());

-- Allow deleting emergency request (creator or admin)
CREATE POLICY "emergency_delete_policy" ON public.emergency_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());


-- 6. MAP POINTS TABLE RLS
ALTER TABLE public.map_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_map_points" ON public.map_points;
DROP POLICY IF EXISTS "insert_map_points" ON public.map_points;
DROP POLICY IF EXISTS "update_map_points" ON public.map_points;
DROP POLICY IF EXISTS "delete_map_points" ON public.map_points;

CREATE POLICY "select_map_points" ON public.map_points
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_map_points" ON public.map_points
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.is_staff_or_admin());

CREATE POLICY "update_map_points" ON public.map_points
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.is_staff_or_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_staff_or_admin());

CREATE POLICY "delete_map_points" ON public.map_points
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin());

-- 7. Ensure Foreign Keys exist for PostgREST joins
ALTER TABLE public.complaints 
  DROP CONSTRAINT IF EXISTS fk_complaints_profiles;
ALTER TABLE public.complaints 
  ADD CONSTRAINT fk_complaints_profiles 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.emergency_requests 
  DROP CONSTRAINT IF EXISTS fk_emergency_requests_profiles;
ALTER TABLE public.emergency_requests 
  ADD CONSTRAINT fk_emergency_requests_profiles 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bills 
  DROP CONSTRAINT IF EXISTS fk_bills_profiles;
ALTER TABLE public.bills 
  ADD CONSTRAINT fk_bills_profiles 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
