/*
# Create super user (admin) account

## Overview
Creates a pre-verified admin user in auth.users so they can sign in immediately
without email confirmation, and sets their profile role to 'admin'.

## Details
- Email: rohitranjanpatra8@gmail.com
- Phone: 7735550648
- Password: Rohit@3478 (bcrypt-hashed via pgcrypto crypt())
- Profile role set to 'admin' (super user)
- Email confirmed at creation time
- Idempotent: guarded by NOT EXISTS check on re-run

## Security
- The password is stored as a bcrypt hash, never plaintext.
- Profile row is upserted and role forced to 'admin'.
*/

-- Insert the user into auth.users if not already present
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  raw_app_meta_data,
  confirmation_token,
  email_change_token_new,
  email_change,
  phone_change,
  is_sso_user
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'rohitranjanpatra8@gmail.com',
  crypt('Rohit@3478', gen_salt('bf')),
  now(),
  '7735550648',
  now(),
  now(),
  now(),
  jsonb_build_object('full_name', 'Rohit Ranjan Patra', 'phone', '7735550648'),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  '',
  '',
  '',
  '',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'rohitranjanpatra8@gmail.com'
);

-- Upsert the profile as admin
INSERT INTO public.profiles (id, full_name, phone, role, language, ward)
SELECT id, 'Rohit Ranjan Patra', '7735550648', 'admin', 'en', 12
FROM auth.users
WHERE email = 'rohitranjanpatra8@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;
