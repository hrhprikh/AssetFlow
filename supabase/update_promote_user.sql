-- ============================================================
-- AssetFlow — Update Promote User RPC
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.promote_user(
  target_user_id UUID,
  new_role public.user_role
) RETURNS VOID AS $$
DECLARE
  caller_role public.user_role;
  old_role public.user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Admin can change roles';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN: You cannot change your own role';
  END IF;

  IF new_role NOT IN ('EMPLOYEE', 'DEPARTMENT_HEAD', 'ASSET_MANAGER') THEN
    RAISE EXCEPTION 'FORBIDDEN: Cannot promote to %', new_role;
  END IF;

  SELECT role INTO old_role FROM public.profiles WHERE id = target_user_id;
  IF old_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Target user does not exist';
  END IF;

  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'ROLE_CHANGE', 'USER', target_user_id,
    jsonb_build_object('old_role', old_role::text, 'new_role', new_role::text)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
