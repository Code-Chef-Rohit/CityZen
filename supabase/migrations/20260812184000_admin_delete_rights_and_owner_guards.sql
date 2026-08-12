-- Migration: Admin Delete Rights & Owner Security Guards
-- Run this in your Supabase SQL Editor to allow admins to delete data, while protecting your owner account.

-- 1. Create secure admin_delete_user RPC function
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
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
    RAISE EXCEPTION 'Access Denied: Only administrators can delete users.';
  END IF;

  -- Guard: Primary owner (Rohit Ranjan Patra) cannot be deleted by other admins
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND (email = 'rohitranjanpatra8@gmail.com' OR phone = '7735550648')
  ) THEN
    RAISE EXCEPTION 'Security Alert: You do not have permission to delete the primary owner account.';
  END IF;

  -- Guard: Admins cannot delete themselves
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Access Denied: You cannot delete your own admin account.';
  END IF;

  -- Delete from auth.users (cascades to profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 2. Drop existing update policy and replace it with owner-guarded one
DROP POLICY IF EXISTS "allow_admins_update_profiles" ON public.profiles;

CREATE POLICY "allow_admins_update_profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    AND (
      id = auth.uid() 
      OR NOT (email = 'rohitranjanpatra8@gmail.com' OR phone = '7735550648')
    )
  )
  WITH CHECK (
    ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    AND (
      id = auth.uid() 
      OR NOT (email = 'rohitranjanpatra8@gmail.com' OR phone = '7735550648')
    )
  );

-- 3. Grant RLS delete privileges on complaints, bills, and emergency requests to Admins
DROP POLICY IF EXISTS "admins_delete_complaints" ON public.complaints;
CREATE POLICY "admins_delete_complaints" ON public.complaints 
  FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "admins_delete_bills" ON public.bills;
CREATE POLICY "admins_delete_bills" ON public.bills 
  FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "admins_delete_emergencies" ON public.emergency_requests;
CREATE POLICY "admins_delete_emergencies" ON public.emergency_requests 
  FOR DELETE 
  TO authenticated 
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
