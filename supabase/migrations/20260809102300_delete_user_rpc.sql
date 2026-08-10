-- RPC function allowing signed-in users to delete their own account and profiles
CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the authenticated user ID
  current_user_id := auth.uid();
  
  -- If not null, execute delete in auth.users (cascades to public.profiles)
  IF current_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = current_user_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized: User is not authenticated';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION delete_current_user() TO authenticated;
