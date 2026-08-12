-- Migration: Update profiles role check constraint & allow admin profile updates
-- Run this in your Supabase SQL Editor to allow promoting users to police, hospital, and bmc roles.

-- 1. Drop the old check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add the updated check constraint supporting all current application roles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('citizen', 'business', 'admin', 'police', 'hospital', 'bmc'));

-- 3. Drop existing admin profile update policy if any
DROP POLICY IF EXISTS "allow_admins_update_profiles" ON public.profiles;

-- 4. Create policy allowing admins to update any profile row
CREATE POLICY "allow_admins_update_profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
