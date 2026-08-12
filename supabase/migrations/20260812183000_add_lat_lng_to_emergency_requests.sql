-- Migration: Add exact latitude and longitude columns to emergency_requests
-- Run this in your Supabase SQL Editor to support map routing for dispatchers (police, fire, ambulance).

ALTER TABLE public.emergency_requests ADD COLUMN IF NOT EXISTS lat numeric(9,6);
ALTER TABLE public.emergency_requests ADD COLUMN IF NOT EXISTS lng numeric(9,6);

-- Add explicit foreign key constraint from emergency_requests to profiles for PostgREST joins
ALTER TABLE public.emergency_requests 
  DROP CONSTRAINT IF EXISTS emergency_requests_user_id_profiles_fkey,
  ADD CONSTRAINT emergency_requests_user_id_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Allow police, hospital, bmc, and admin to read all profiles (resolves hidden details issue)
DROP POLICY IF EXISTS "allow_staff_read_profiles" ON public.profiles;
CREATE POLICY "allow_staff_read_profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'police', 'hospital', 'bmc')
  );
