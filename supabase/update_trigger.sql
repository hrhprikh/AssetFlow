-- ============================================================
-- AssetFlow — Update Auth Trigger for Dynamic Roles
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  requested_role public.user_role;
BEGIN
  -- Try to parse the requested role from metadata
  BEGIN
    requested_role := (new.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    requested_role := 'EMPLOYEE'::public.user_role;
  END;
  
  IF requested_role IS NULL THEN
    requested_role := 'EMPLOYEE'::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    new.email,
    requested_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
