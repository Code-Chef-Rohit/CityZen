-- Migration: Update profiles role check constraint to include staff roles
-- Run this in your Supabase SQL Editor to allow promoting users to police, hospital, and bmc roles.

-- 1. Drop the old check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add the updated check constraint supporting all current application roles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('citizen', 'business', 'admin', 'police', 'hospital', 'bmc'));
