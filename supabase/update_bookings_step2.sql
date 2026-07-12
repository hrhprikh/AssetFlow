-- STEP 2: Update tables and RPCs
-- NOTE: ONLY run this AFTER update_bookings_step1.sql has been successfully executed.

-- Change the default on the table
ALTER TABLE public.bookings ALTER COLUMN status SET DEFAULT 'PENDING';

-- Update create_booking RPC to use PENDING status instead of UPCOMING
CREATE OR REPLACE FUNCTION public.create_booking(
  p_asset_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_purpose TEXT DEFAULT NULL,
  p_department_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  asset_rec RECORD;
  overlap_count INTEGER;
  booking_id UUID;
BEGIN
  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE: End must be after start';
  END IF;

  SELECT * INTO asset_rec FROM public.assets WHERE id = p_asset_id FOR UPDATE;
  IF asset_rec IS NULL THEN
    RAISE EXCEPTION 'ASSET_NOT_FOUND';
  END IF;
  IF NOT asset_rec.is_bookable THEN
    RAISE EXCEPTION 'ASSET_NOT_BOOKABLE: This asset is not available for booking';
  END IF;
  IF asset_rec.status IN ('RETIRED', 'DISPOSED', 'UNDER_MAINTENANCE', 'LOST') THEN
    RAISE EXCEPTION 'ASSET_NOT_AVAILABLE: Asset is %', asset_rec.status;
  END IF;

  -- Overlap check: new_start < existing_end AND new_end > existing_start
  SELECT COUNT(*) INTO overlap_count
  FROM public.bookings
  WHERE asset_id = p_asset_id
    AND status IN ('PENDING', 'UPCOMING', 'ONGOING')
    AND p_start_at < end_at
    AND p_end_at > start_at;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'BOOKING_OVERLAP: Time slot conflicts with an existing booking';
  END IF;

  INSERT INTO public.bookings (asset_id, requester_id, start_at, end_at, purpose, department_id, status)
  VALUES (p_asset_id, auth.uid(), p_start_at, p_end_at, p_purpose, p_department_id, 'PENDING')
  RETURNING id INTO booking_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'BOOKING_CREATED', 'BOOKING', booking_id,
    jsonb_build_object('asset_id', p_asset_id::text, 'start', p_start_at::text, 'end', p_end_at::text)
  );

  RETURN booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create approve_booking RPC
CREATE OR REPLACE FUNCTION public.approve_booking(
  p_booking_id UUID,
  p_status TEXT, -- 'UPCOMING' for approve, 'REJECTED' for reject
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  b RECORD;
  caller_role public.user_role;
  caller_dept UUID;
  asset_dept UUID;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  
  IF b.status != 'PENDING' THEN
    RAISE EXCEPTION 'BOOKING_NOT_PENDING: Cannot approve/reject booking in % state', b.status;
  END IF;

  IF p_status NOT IN ('UPCOMING', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Must be UPCOMING or REJECTED';
  END IF;

  SELECT role, department_id INTO caller_role, caller_dept FROM public.profiles WHERE id = auth.uid();
  SELECT current_department_id INTO asset_dept FROM public.assets WHERE id = b.asset_id;

  -- Only ADMIN, ASSET_MANAGER, or the DEPARTMENT_HEAD of the asset's department can approve
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
    IF caller_role = 'DEPARTMENT_HEAD' THEN
      IF caller_dept IS DISTINCT FROM asset_dept THEN
        RAISE EXCEPTION 'FORBIDDEN: You do not manage this asset''s department';
      END IF;
    ELSE
      RAISE EXCEPTION 'FORBIDDEN: Only Managers and Department Heads can approve bookings';
    END IF;
  END IF;

  UPDATE public.bookings 
  SET status = p_status::public.booking_status, updated_at = now() 
  WHERE id = p_booking_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'BOOKING_' || p_status, 'BOOKING', p_booking_id, jsonb_build_object('notes', p_notes));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update get_dashboard_kpis RPC
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis()
RETURNS JSONB AS $$
DECLARE
  kpis JSONB;
  caller_role public.user_role;
  caller_dept UUID;
  is_org_wide BOOLEAN;
BEGIN
  SELECT role, department_id INTO caller_role, caller_dept
  FROM public.profiles WHERE id = auth.uid();

  is_org_wide := caller_role IN ('ADMIN', 'ASSET_MANAGER');

  SELECT jsonb_build_object(
    'available_assets', (
      SELECT COUNT(*) FROM public.assets
      WHERE status = 'AVAILABLE'
        AND (is_org_wide OR current_department_id = caller_dept)
    ),
    'allocated_assets', (
      SELECT COUNT(*) FROM public.assets
      WHERE status = 'ALLOCATED'
        AND (is_org_wide OR current_department_id = caller_dept)
    ),
    'under_maintenance', (
      SELECT COUNT(*) FROM public.assets
      WHERE status = 'UNDER_MAINTENANCE'
        AND (is_org_wide OR current_department_id = caller_dept)
    ),
    'active_bookings', (
      SELECT COUNT(*) FROM public.bookings
      WHERE status IN ('UPCOMING', 'ONGOING')
        AND (is_org_wide OR requester_id = auth.uid())
    ),
    'pending_bookings', (
      SELECT COUNT(*) FROM public.bookings
      WHERE status = 'PENDING'
        AND (
          is_org_wide 
          OR requester_id = auth.uid() 
          OR asset_id IN (SELECT id FROM public.assets WHERE current_department_id = caller_dept)
        )
    ),
    'overdue_returns', (
      SELECT COUNT(*) FROM public.allocations
      WHERE status = 'ACTIVE'
        AND expected_return_at IS NOT NULL
        AND expected_return_at < now()
        AND returned_at IS NULL
        AND (is_org_wide OR holder_id = auth.uid())
    ),
    'pending_transfers', (
      SELECT COUNT(*) FROM public.transfer_requests
      WHERE status = 'REQUESTED'
        AND (is_org_wide OR requested_by = auth.uid())
    ),
    'pending_maintenance', (
      SELECT COUNT(*) FROM public.maintenance_requests
      WHERE status = 'PENDING'
        AND (is_org_wide OR raised_by = auth.uid())
    ),
    'total_assets', (
      SELECT COUNT(*) FROM public.assets
      WHERE status NOT IN ('DISPOSED')
        AND (is_org_wide OR current_department_id = caller_dept)
    )
  ) INTO kpis;

  RETURN kpis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
