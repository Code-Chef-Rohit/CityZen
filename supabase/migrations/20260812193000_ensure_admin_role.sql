-- Migration: Ensure Primary Owner and Admins have role = 'admin'
-- Run this in your Supabase SQL Editor

-- 1. Ensure email column exists on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Update role to 'admin' for primary owner Rohit Ranjan Patra
UPDATE public.profiles
SET 
  role = 'admin',
  full_name = CASE WHEN full_name IS NULL OR full_name = '' THEN 'Rohit Ranjan Patra' ELSE full_name END,
  email = 'rohitranjanpatra8@gmail.com'
WHERE id IN (
  SELECT id FROM auth.users WHERE email ILIKE 'rohitranjanpatra8@gmail.com'
) OR email ILIKE 'rohitranjanpatra8@gmail.com';

-- 3. In case the profile row doesn't exist yet for the auth user, create it
INSERT INTO public.profiles (id, full_name, email, phone, role, language, ward)
SELECT 
  u.id,
  'Rohit Ranjan Patra',
  'rohitranjanpatra8@gmail.com',
  '7735550648',
  'admin',
  'en',
  12
FROM auth.users u
WHERE u.email ILIKE 'rohitranjanpatra8@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'admin',
  email = 'rohitranjanpatra8@gmail.com';

-- 4. Ensure RLS allows users to insert & select their own profile
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
