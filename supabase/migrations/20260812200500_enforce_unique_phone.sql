-- =========================================================================
-- CLEAN UP EXISTING DUPLICATE PHONES & ENFORCE UNIQUE PHONE NUMBERS
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- =========================================================================

-- Step 1: Standardize phone digits (strip spaces, hyphens, country codes)
UPDATE public.profiles
SET phone = REGEXP_REPLACE(phone, '\D', '', 'g')
WHERE phone IS NOT NULL AND TRIM(phone) != '';

-- Step 2: Resolve existing duplicate phone numbers (e.g. 8260382361)
-- Keep the phone on the primary owner or most recent account, set older duplicates to NULL
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY phone
           ORDER BY 
             CASE WHEN email ILIKE 'rohitranjanpatra8@gmail.com' THEN 0 ELSE 1 END,
             created_at DESC
         ) as rank_num
  FROM public.profiles
  WHERE phone IS NOT NULL AND TRIM(phone) != ''
)
UPDATE public.profiles
SET phone = NULL
WHERE id IN (
  SELECT id FROM duplicates WHERE rank_num > 1
);

-- Step 3: Create function to normalize and prevent duplicate phone numbers
CREATE OR REPLACE FUNCTION public.check_phone_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND TRIM(NEW.phone) != '' THEN
    -- Strip non-digit characters to standardize format
    NEW.phone := REGEXP_REPLACE(NEW.phone, '\D', '', 'g');
    
    -- Check if another user already owns this phone number
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE phone = NEW.phone 
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'This phone number (%) is already registered to another user account. Each account must have a unique mobile number.', NEW.phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 4: Attach trigger to profiles table
DROP TRIGGER IF EXISTS trg_check_phone_uniqueness ON public.profiles;
CREATE TRIGGER trg_check_phone_uniqueness
  BEFORE INSERT OR UPDATE OF phone
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_phone_uniqueness();

-- Step 5: Create Unique Partial Index for instant lookup & atomic constraint
DROP INDEX IF EXISTS public.idx_profiles_unique_phone;
CREATE UNIQUE INDEX idx_profiles_unique_phone 
ON public.profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';
