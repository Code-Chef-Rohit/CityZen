-- Migration: Account Deletion Grace Period and Admin Timing Controls
-- Adds deletion tracking columns to profiles table

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_status TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Index for querying deletion pending users
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled 
  ON public.profiles(deletion_scheduled_at) 
  WHERE deletion_status = 'scheduled';

-- Ensure authenticated users can update their own deletion schedule
DROP POLICY IF EXISTS "users_update_own_deletion_schedule" ON public.profiles;
CREATE POLICY "users_update_own_deletion_schedule" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Ensure admins can modify any user's deletion schedule
DROP POLICY IF EXISTS "admins_update_deletion_schedule" ON public.profiles;
CREATE POLICY "admins_update_deletion_schedule" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
