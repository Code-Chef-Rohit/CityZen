-- =========================================================================
-- MIGRATION: Check User Auth Provider & Admin Notification Policies
-- Allows checking if an email is registered with Google OAuth or email/password
-- and permits admins to send official role notifications to users.
-- =========================================================================

-- 1. Helper function to check auth provider for an email (executable by anon & authenticated)
CREATE OR REPLACE FUNCTION public.check_user_auth_provider(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_user record;
  v_has_google boolean := false;
  v_has_password boolean := false;
  v_profile record;
BEGIN
  -- Find user in auth.users by email (case-insensitive)
  SELECT * INTO v_user 
  FROM auth.users 
  WHERE LOWER(email) = LOWER(TRIM(p_email)) 
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  -- Check if user has Google identity or Google provider in metadata
  SELECT EXISTS (
    SELECT 1 FROM auth.identities 
    WHERE user_id = v_user.id AND provider = 'google'
  ) OR (COALESCE(v_user.raw_app_meta_data->>'provider', '') = 'google') INTO v_has_google;

  -- Check if user has an encrypted password set
  SELECT (v_user.encrypted_password IS NOT NULL AND v_user.encrypted_password <> '') INTO v_has_password;

  -- Fetch associated profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'exists', true,
    'is_google', v_has_google,
    'has_password', v_has_password,
    'full_name', COALESCE(v_profile.full_name, v_user.raw_user_meta_data->>'full_name', ''),
    'email', v_user.email,
    'role', COALESCE(v_profile.role, 'citizen')
  );
END;
$$;

-- Grant execution to all users (needed on signin screen before login)
GRANT EXECUTE ON FUNCTION public.check_user_auth_provider(text) TO anon, authenticated;

-- 2. Ensure Admin can insert notifications for any citizen
DO $$
BEGIN
  DROP POLICY IF EXISTS "notifications_admin_insert" ON public.notifications;
  CREATE POLICY "notifications_admin_insert" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin());
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
