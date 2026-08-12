-- =========================================================================
-- FIX INFINITE RECURSION IN PROFILES ON SUPABASE POSTGRES
-- Run this entire script in Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- =========================================================================

-- 1. Helper function with row_security = off (Guarantees NO infinite recursion!)
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

-- Helper RPC to fetch profiles with security definer (Zero RLS overhead or recursion)
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

-- 2. DROP ALL EXISTING POLICIES ON PROFILES (Removes all recursive subqueries!)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. RECREATE CLEAN, NON-RECURSIVE POLICIES ON PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: simple boolean true without subqueries (avoids all recursion!)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: user can insert own row or admin can insert
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- UPDATE: user can update own row or admin can update any row
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- DELETE: user can delete own profile or admin can delete
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id OR public.is_admin());


-- 4. DROP ALL EXISTING POLICIES ON COMPLAINTS AND RECREATE CLEAN ONES
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'complaints' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.complaints', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_select_all" ON public.complaints
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "complaints_insert_policy" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "complaints_update_all" ON public.complaints
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());

CREATE POLICY "complaints_delete_policy" ON public.complaints
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());


-- 5. DROP ALL EXISTING POLICIES ON BILLS AND RECREATE CLEAN ONES
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'bills' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bills', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills_select_policy" ON public.bills
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "bills_insert_policy" ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "bills_update_policy" ON public.bills
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "bills_delete_policy" ON public.bills
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());


-- 6. DROP ALL EXISTING POLICIES ON EMERGENCY_REQUESTS AND RECREATE CLEAN ONES
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'emergency_requests' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.emergency_requests', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_select_policy" ON public.emergency_requests
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "emergency_insert_policy" ON public.emergency_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "emergency_update_policy" ON public.emergency_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());

CREATE POLICY "emergency_delete_policy" ON public.emergency_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());


-- 7. Ensure Rohit Ranjan Patra is Super Admin
UPDATE public.profiles
SET 
  role = 'admin',
  full_name = CASE WHEN full_name IS NULL OR full_name = '' THEN 'Rohit Ranjan Patra' ELSE full_name END,
  email = 'rohitranjanpatra8@gmail.com'
WHERE id IN (
  SELECT id FROM auth.users WHERE email ILIKE 'rohitranjanpatra8@gmail.com'
) OR email ILIKE 'rohitranjanpatra8@gmail.com';
