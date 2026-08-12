-- Migration: Add Real Geolocation, BMC Resolution Proof Photo, ML Verification Columns, and RLS Policies for Complaints
-- Run this in your Supabase SQL Editor

-- 1. Add missing columns to complaints table
ALTER TABLE public.complaints 
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS resolution_proof text,
  ADD COLUMN IF NOT EXISTS resolution_photo_url text,
  ADD COLUMN IF NOT EXISTS visual_hash text,
  ADD COLUMN IF NOT EXISTS ml_verification_score integer DEFAULT 100;

-- 2. Foreign Key link between complaints.user_id and profiles.id for relational joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_complaints_profiles' AND table_name = 'complaints'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT fk_complaints_profiles
      FOREIGN KEY (user_id) REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3. RLS Policies for Complaints
-- Allow all authenticated users to read complaints for the City Feed & map
DROP POLICY IF EXISTS "select_all_complaints_authenticated" ON public.complaints;
CREATE POLICY "select_all_complaints_authenticated" ON public.complaints
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow BMC and Admin to update complaint status, resolution proof notes, and proof photos
DROP POLICY IF EXISTS "staff_and_admin_update_complaints" ON public.complaints;
CREATE POLICY "staff_and_admin_update_complaints" ON public.complaints
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('bmc', 'admin')
    OR auth.uid() = user_id
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('bmc', 'admin')
    OR auth.uid() = user_id
  );
