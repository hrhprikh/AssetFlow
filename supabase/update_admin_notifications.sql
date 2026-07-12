-- ============================================================
-- AssetFlow — Admin Notifications for Transfers & Returns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Update Return Asset Logic
CREATE OR REPLACE FUNCTION public.return_asset(
  p_asset_id UUID,
  p_return_condition TEXT DEFAULT NULL,
  p_return_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  alloc RECORD;
BEGIN
  SELECT * INTO alloc FROM public.allocations
  WHERE asset_id = p_asset_id AND status = 'ACTIVE' FOR UPDATE;

  IF alloc IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_ALLOCATION: No active allocation found for this asset';
  END IF;

  UPDATE public.allocations
  SET status = 'RETURNED', returned_at = now(),
      return_condition = p_return_condition, return_notes = p_return_notes
  WHERE id = alloc.id;

  UPDATE public.assets SET status = 'AVAILABLE', updated_at = now() WHERE id = p_asset_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'ASSET_RETURNED', 'ASSET', p_asset_id,
    jsonb_build_object('condition', p_return_condition, 'allocation_id', alloc.id::text)
  );

  -- NOTIFY ADMINS AND ASSET MANAGERS
  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT id, 'ASSET_RETURNED', 'Asset Returned', 
         'An asset has just been returned by an employee and is now Available.', 'ASSET', p_asset_id
  FROM public.profiles
  WHERE role IN ('ADMIN', 'ASSET_MANAGER');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update Request Transfer Logic
CREATE OR REPLACE FUNCTION public.request_transfer(
  p_asset_id UUID,
  p_target_holder_type TEXT,
  p_target_holder_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  alloc RECORD;
  transfer_id UUID;
BEGIN
  SELECT * INTO alloc FROM public.allocations
  WHERE asset_id = p_asset_id AND status = 'ACTIVE';

  IF alloc IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_ALLOCATION';
  END IF;

  INSERT INTO public.transfer_requests (
    asset_id, from_allocation_id, target_holder_type, target_holder_id,
    requested_by, status, reason
  ) VALUES (
    p_asset_id, alloc.id, p_target_holder_type, p_target_holder_id,
    auth.uid(), 'REQUESTED', p_reason
  ) RETURNING id INTO transfer_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'TRANSFER_REQUESTED', 'ASSET', p_asset_id,
    jsonb_build_object('transfer_id', transfer_id::text, 'target', p_target_holder_id::text)
  );

  -- NOTIFY ADMINS AND ASSET MANAGERS
  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT id, 'TRANSFER_REQUESTED', 'New Transfer Request', 
         'An employee has requested to transfer an asset to someone else. Approval required.', 'ASSET', p_asset_id
  FROM public.profiles
  WHERE role IN ('ADMIN', 'ASSET_MANAGER');

  RETURN transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
