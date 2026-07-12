-- ============================================================
-- AssetFlow — Phase 1: Foundation & Identity
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUMS
-- ============================================================

CREATE TYPE public.user_role AS ENUM (
  'ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE', 'AUDITOR'
);

CREATE TYPE public.entity_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE public.asset_status AS ENUM (
  'AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE',
  'LOST', 'RETIRED', 'DISPOSED'
);

CREATE TYPE public.allocation_status AS ENUM ('ACTIVE', 'RETURNED', 'TRANSFERRED');
CREATE TYPE public.transfer_status AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

CREATE TYPE public.booking_status AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

CREATE TYPE public.maintenance_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE public.maintenance_status AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED',
  'IN_PROGRESS', 'RESOLVED'
);

CREATE TYPE public.audit_cycle_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
CREATE TYPE public.audit_result AS ENUM ('PENDING', 'VERIFIED', 'MISSING', 'DAMAGED');


-- ============================================================
-- 2. CORE TABLES — Phase 1
-- ============================================================

-- Departments (created first since profiles references it)
CREATE TABLE public.departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  parent_id     UUID REFERENCES public.departments(id),
  head_user_id  UUID, -- FK added after profiles table
  status        public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT UNIQUE NOT NULL,
  role          public.user_role NOT NULL DEFAULT 'EMPLOYEE',
  department_id UUID REFERENCES public.departments(id),
  status        public.entity_status NOT NULL DEFAULT 'ACTIVE',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from departments.head_user_id to profiles
ALTER TABLE public.departments
  ADD CONSTRAINT fk_departments_head
  FOREIGN KEY (head_user_id) REFERENCES public.profiles(id);

-- Asset Categories
CREATE TABLE public.asset_categories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  custom_field_schema JSONB DEFAULT '{}',
  status              public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Logs (immutable)
CREATE TABLE public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 3. ASSET TABLES — Phase 2
-- ============================================================

CREATE TABLE public.assets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag             TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  category_id           UUID NOT NULL REFERENCES public.asset_categories(id),
  serial_number         TEXT,
  acquisition_date      DATE,
  acquisition_cost      NUMERIC(12,2),
  condition             TEXT DEFAULT 'New',
  location              TEXT,
  status                public.asset_status NOT NULL DEFAULT 'AVAILABLE',
  is_bookable           BOOLEAN NOT NULL DEFAULT FALSE,
  current_department_id UUID REFERENCES public.departments(id),
  custom_fields         JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_type   TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. ALLOCATION & TRANSFER TABLES — Phase 3
-- ============================================================

CREATE TABLE public.allocations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES public.assets(id),
  holder_type         TEXT NOT NULL CHECK (holder_type IN ('EMPLOYEE', 'DEPARTMENT')),
  holder_id           UUID NOT NULL,
  allocated_by        UUID NOT NULL REFERENCES public.profiles(id),
  allocated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_at  TIMESTAMPTZ,
  returned_at         TIMESTAMPTZ,
  return_condition    TEXT,
  return_notes        TEXT,
  status              public.allocation_status NOT NULL DEFAULT 'ACTIVE',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRITICAL: Only one active allocation per asset
CREATE UNIQUE INDEX idx_one_active_allocation
  ON public.allocations (asset_id) WHERE status = 'ACTIVE';

CREATE INDEX idx_allocations_overdue
  ON public.allocations (expected_return_at, status)
  WHERE status = 'ACTIVE';

CREATE TABLE public.transfer_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES public.assets(id),
  from_allocation_id  UUID NOT NULL REFERENCES public.allocations(id),
  target_holder_type  TEXT NOT NULL CHECK (target_holder_type IN ('EMPLOYEE', 'DEPARTMENT')),
  target_holder_id    UUID NOT NULL,
  requested_by        UUID NOT NULL REFERENCES public.profiles(id),
  approved_by         UUID REFERENCES public.profiles(id),
  status              public.transfer_status NOT NULL DEFAULT 'REQUESTED',
  reason              TEXT,
  decision_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at          TIMESTAMPTZ
);


-- ============================================================
-- 5. BOOKING & MAINTENANCE TABLES — Phase 4
-- ============================================================

CREATE TABLE public.bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES public.assets(id),
  requester_id    UUID NOT NULL REFERENCES public.profiles(id),
  department_id   UUID REFERENCES public.departments(id),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  purpose         TEXT,
  status          public.booking_status NOT NULL DEFAULT 'UPCOMING',
  reminder_sent_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

CREATE INDEX idx_booking_overlap
  ON public.bookings (asset_id, start_at, end_at, status);

CREATE TABLE public.maintenance_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID NOT NULL REFERENCES public.assets(id),
  raised_by        UUID NOT NULL REFERENCES public.profiles(id),
  issue            TEXT NOT NULL,
  priority         public.maintenance_priority NOT NULL DEFAULT 'MEDIUM',
  status           public.maintenance_status NOT NULL DEFAULT 'PENDING',
  approved_by      UUID REFERENCES public.profiles(id),
  technician       TEXT,
  approved_at      TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 6. AUDIT TABLES — Phase 5
-- ============================================================

CREATE TABLE public.audit_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  scope_type  TEXT NOT NULL CHECK (scope_type IN ('DEPARTMENT', 'LOCATION')),
  scope_id    UUID,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      public.audit_cycle_status NOT NULL DEFAULT 'DRAFT',
  created_by  UUID REFERENCES public.profiles(id),
  closed_by   UUID REFERENCES public.profiles(id),
  closed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_assignments (
  audit_cycle_id  UUID REFERENCES public.audit_cycles(id) ON DELETE CASCADE,
  auditor_id      UUID REFERENCES public.profiles(id),
  PRIMARY KEY (audit_cycle_id, auditor_id)
);

CREATE TABLE public.audit_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_cycle_id    UUID NOT NULL REFERENCES public.audit_cycles(id),
  asset_id          UUID NOT NULL REFERENCES public.assets(id),
  result            public.audit_result NOT NULL DEFAULT 'PENDING',
  notes             TEXT,
  evidence_url      TEXT,
  verified_by       UUID REFERENCES public.profiles(id),
  verified_at       TIMESTAMPTZ,
  resolution_status TEXT,
  UNIQUE (audit_cycle_id, asset_id)
);


-- ============================================================
-- 7. NOTIFICATIONS TABLE — Phase 5
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  entity_type TEXT,
  entity_id   UUID,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user
  ON public.notifications (user_id, created_at DESC);


-- ============================================================
-- 8. HELPER FUNCTIONS
-- ============================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's department
CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS UUID AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- 9. AUTH TRIGGER — Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'EMPLOYEE',
    'ACTIVE'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 10. RPC FUNCTIONS — Phase 1
-- ============================================================

-- Promote / Demote user (Admin only)
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


-- ============================================================
-- 11. RPC FUNCTIONS — Phase 2 (Assets)
-- ============================================================

-- Generate next asset tag: AF-0001, AF-0002, ...
CREATE OR REPLACE FUNCTION public.generate_asset_tag()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(asset_tag FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM public.assets;
  RETURN 'AF-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Register a new asset
CREATE OR REPLACE FUNCTION public.register_asset(
  p_name TEXT,
  p_category_id UUID,
  p_serial_number TEXT DEFAULT NULL,
  p_acquisition_date DATE DEFAULT NULL,
  p_acquisition_cost NUMERIC DEFAULT NULL,
  p_condition TEXT DEFAULT 'New',
  p_location TEXT DEFAULT NULL,
  p_is_bookable BOOLEAN DEFAULT FALSE,
  p_department_id UUID DEFAULT NULL,
  p_custom_fields JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  caller_role public.user_role;
  new_tag TEXT;
  new_id UUID;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Admin or Asset Manager can register assets';
  END IF;

  new_tag := public.generate_asset_tag();

  INSERT INTO public.assets (
    asset_tag, name, category_id, serial_number,
    acquisition_date, acquisition_cost, condition, location,
    is_bookable, current_department_id, custom_fields
  ) VALUES (
    new_tag, p_name, p_category_id, p_serial_number,
    p_acquisition_date, p_acquisition_cost, p_condition, p_location,
    p_is_bookable, p_department_id, p_custom_fields
  ) RETURNING id INTO new_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'ASSET_REGISTERED', 'ASSET', new_id,
    jsonb_build_object('asset_tag', new_tag, 'name', p_name)
  );

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate and execute asset state transitions
CREATE OR REPLACE FUNCTION public.transition_asset_status(
  p_asset_id UUID,
  p_new_status public.asset_status,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  current_st public.asset_status;
  valid BOOLEAN := FALSE;
BEGIN
  SELECT status INTO current_st FROM public.assets WHERE id = p_asset_id FOR UPDATE;

  IF current_st IS NULL THEN
    RAISE EXCEPTION 'ASSET_NOT_FOUND';
  END IF;

  valid := CASE
    WHEN current_st = 'AVAILABLE'         AND p_new_status IN ('ALLOCATED','RESERVED','UNDER_MAINTENANCE','LOST','RETIRED','DISPOSED') THEN TRUE
    WHEN current_st = 'ALLOCATED'         AND p_new_status IN ('AVAILABLE','UNDER_MAINTENANCE','LOST','RETIRED') THEN TRUE
    WHEN current_st = 'RESERVED'          AND p_new_status IN ('AVAILABLE','ALLOCATED','UNDER_MAINTENANCE') THEN TRUE
    WHEN current_st = 'UNDER_MAINTENANCE' AND p_new_status IN ('AVAILABLE','ALLOCATED','RETIRED','DISPOSED') THEN TRUE
    WHEN current_st = 'LOST'              AND p_new_status IN ('AVAILABLE','RETIRED','DISPOSED') THEN TRUE
    WHEN current_st = 'RETIRED'           AND p_new_status = 'DISPOSED' THEN TRUE
    ELSE FALSE
  END;

  IF NOT valid THEN
    RAISE EXCEPTION 'INVALID_ASSET_TRANSITION: Cannot move from % to %', current_st, p_new_status;
  END IF;

  UPDATE public.assets SET status = p_new_status, updated_at = now() WHERE id = p_asset_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'STATUS_CHANGE', 'ASSET', p_asset_id,
    jsonb_build_object('from', current_st::text, 'to', p_new_status::text, 'reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 12. RPC FUNCTIONS — Phase 3 (Allocations & Transfers)
-- ============================================================

-- Allocate asset (concurrency-safe with FOR UPDATE)
CREATE OR REPLACE FUNCTION public.allocate_asset(
  p_asset_id UUID,
  p_holder_type TEXT,
  p_holder_id UUID,
  p_expected_return_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  caller_role public.user_role;
  current_st public.asset_status;
  existing_holder UUID;
  alloc_id UUID;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Admin or Asset Manager can allocate';
  END IF;

  -- Lock the asset row
  SELECT status INTO current_st FROM public.assets WHERE id = p_asset_id FOR UPDATE;

  IF current_st IS NULL THEN
    RAISE EXCEPTION 'ASSET_NOT_FOUND';
  END IF;

  IF current_st != 'AVAILABLE' THEN
    SELECT holder_id INTO existing_holder
    FROM public.allocations WHERE asset_id = p_asset_id AND status = 'ACTIVE';
    RAISE EXCEPTION 'ASSET_NOT_AVAILABLE: Asset is %. Current holder: %', current_st, COALESCE(existing_holder::text, 'N/A');
  END IF;

  INSERT INTO public.allocations (
    asset_id, holder_type, holder_id, allocated_by, expected_return_at, status
  ) VALUES (
    p_asset_id, p_holder_type, p_holder_id, auth.uid(), p_expected_return_at, 'ACTIVE'
  ) RETURNING id INTO alloc_id;

  UPDATE public.assets SET status = 'ALLOCATED', updated_at = now() WHERE id = p_asset_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'ASSET_ALLOCATED', 'ASSET', p_asset_id,
    jsonb_build_object('holder_id', p_holder_id::text, 'holder_type', p_holder_type, 'allocation_id', alloc_id::text)
  );

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    p_holder_id, 'ASSET_ASSIGNED', 'Asset Assigned',
    'An asset has been allocated to you.', 'ASSET', p_asset_id
  );

  RETURN alloc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Return asset
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request transfer
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

  RETURN transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve transfer (atomic close + re-allocate)
CREATE OR REPLACE FUNCTION public.approve_transfer(p_transfer_id UUID)
RETURNS VOID AS $$
DECLARE
  t RECORD;
  caller_role public.user_role;
  new_alloc_id UUID;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO t FROM public.transfer_requests WHERE id = p_transfer_id FOR UPDATE;
  IF t.status != 'REQUESTED' THEN
    RAISE EXCEPTION 'Transfer is not in REQUESTED state';
  END IF;

  -- Close old allocation
  UPDATE public.allocations SET status = 'TRANSFERRED', returned_at = now()
  WHERE id = t.from_allocation_id;

  -- Create new allocation
  INSERT INTO public.allocations (
    asset_id, holder_type, holder_id, allocated_by, status
  ) VALUES (
    t.asset_id, t.target_holder_type, t.target_holder_id, auth.uid(), 'ACTIVE'
  ) RETURNING id INTO new_alloc_id;

  -- Update transfer
  UPDATE public.transfer_requests
  SET status = 'APPROVED', approved_by = auth.uid(), decided_at = now()
  WHERE id = p_transfer_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'TRANSFER_APPROVED', 'ASSET', t.asset_id,
    jsonb_build_object('transfer_id', p_transfer_id::text, 'new_allocation_id', new_alloc_id::text)
  );

  -- Notify target holder
  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    t.target_holder_id, 'TRANSFER_APPROVED', 'Transfer Approved',
    'An asset has been transferred to you.', 'ASSET', t.asset_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject transfer
CREATE OR REPLACE FUNCTION public.reject_transfer(
  p_transfer_id UUID,
  p_decision_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  t RECORD;
  caller_role public.user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO t FROM public.transfer_requests WHERE id = p_transfer_id FOR UPDATE;
  IF t.status != 'REQUESTED' THEN
    RAISE EXCEPTION 'Transfer is not in REQUESTED state';
  END IF;

  UPDATE public.transfer_requests
  SET status = 'REJECTED', approved_by = auth.uid(), decided_at = now(),
      decision_notes = p_decision_notes
  WHERE id = p_transfer_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'TRANSFER_REJECTED', 'ASSET', t.asset_id,
    jsonb_build_object('transfer_id', p_transfer_id::text, 'notes', p_decision_notes)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 13. RPC FUNCTIONS — Phase 4 (Bookings & Maintenance)
-- ============================================================

-- Create booking (overlap-safe)
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
    AND status NOT IN ('CANCELLED', 'COMPLETED')
    AND p_start_at < end_at
    AND p_end_at > start_at;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'BOOKING_OVERLAP: Time slot conflicts with an existing booking';
  END IF;

  INSERT INTO public.bookings (asset_id, requester_id, start_at, end_at, purpose, department_id)
  VALUES (p_asset_id, auth.uid(), p_start_at, p_end_at, p_purpose, p_department_id)
  RETURNING id INTO booking_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'BOOKING_CREATED', 'BOOKING', booking_id,
    jsonb_build_object('asset_id', p_asset_id::text, 'start', p_start_at::text, 'end', p_end_at::text)
  );

  RETURN booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel booking
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id UUID)
RETURNS VOID AS $$
DECLARE
  b RECORD;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF b IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  IF b.status NOT IN ('UPCOMING', 'ONGOING') THEN
    RAISE EXCEPTION 'Cannot cancel booking in % state', b.status;
  END IF;

  -- Owner or admin/manager
  IF b.requester_id != auth.uid() THEN
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
      RAISE EXCEPTION 'FORBIDDEN: Only booking owner or Admin/Manager can cancel';
    END IF;
  END IF;

  UPDATE public.bookings SET status = 'CANCELLED', updated_at = now() WHERE id = p_booking_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'BOOKING_CANCELLED', 'BOOKING', p_booking_id, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Raise maintenance request (does NOT change asset status)
CREATE OR REPLACE FUNCTION public.raise_maintenance(
  p_asset_id UUID,
  p_issue TEXT,
  p_priority public.maintenance_priority DEFAULT 'MEDIUM'
) RETURNS UUID AS $$
DECLARE
  req_id UUID;
BEGIN
  INSERT INTO public.maintenance_requests (asset_id, raised_by, issue, priority, status)
  VALUES (p_asset_id, auth.uid(), p_issue, p_priority, 'PENDING')
  RETURNING id INTO req_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), 'MAINTENANCE_RAISED', 'MAINTENANCE', req_id,
    jsonb_build_object('asset_id', p_asset_id::text, 'priority', p_priority::text)
  );

  RETURN req_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve maintenance (changes asset to UNDER_MAINTENANCE)
CREATE OR REPLACE FUNCTION public.approve_maintenance(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  req RECORD;
  caller_role public.user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Admin or Asset Manager can approve maintenance';
  END IF;

  SELECT * INTO req FROM public.maintenance_requests WHERE id = p_request_id FOR UPDATE;
  IF req.status != 'PENDING' THEN
    RAISE EXCEPTION 'Request is not in PENDING state';
  END IF;

  UPDATE public.maintenance_requests
  SET status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_request_id;

  -- Change asset to Under Maintenance via state machine
  PERFORM public.transition_asset_status(req.asset_id, 'UNDER_MAINTENANCE', 'Maintenance approved');

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    req.raised_by, 'MAINTENANCE_APPROVED', 'Maintenance Approved',
    'Your maintenance request has been approved.', 'MAINTENANCE', p_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject maintenance
CREATE OR REPLACE FUNCTION public.reject_maintenance(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  req RECORD;
  caller_role public.user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO req FROM public.maintenance_requests WHERE id = p_request_id FOR UPDATE;
  IF req.status != 'PENDING' THEN RAISE EXCEPTION 'Not PENDING'; END IF;

  UPDATE public.maintenance_requests
  SET status = 'REJECTED', approved_by = auth.uid(), approved_at = now(),
      resolution_notes = p_notes
  WHERE id = p_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    req.raised_by, 'MAINTENANCE_REJECTED', 'Maintenance Rejected',
    'Your maintenance request has been rejected.', 'MAINTENANCE', p_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve maintenance
CREATE OR REPLACE FUNCTION public.resolve_maintenance(
  p_request_id UUID,
  p_resolution_notes TEXT DEFAULT NULL,
  p_resulting_status public.asset_status DEFAULT 'AVAILABLE'
) RETURNS VOID AS $$
DECLARE
  req RECORD;
  caller_role public.user_role;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('ADMIN', 'ASSET_MANAGER') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO req FROM public.maintenance_requests WHERE id = p_request_id FOR UPDATE;
  IF req.status NOT IN ('APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Cannot resolve from % state', req.status;
  END IF;

  UPDATE public.maintenance_requests
  SET status = 'RESOLVED', resolved_at = now(), resolution_notes = p_resolution_notes
  WHERE id = p_request_id;

  PERFORM public.transition_asset_status(req.asset_id, p_resulting_status, 'Maintenance resolved');

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    req.raised_by, 'MAINTENANCE_RESOLVED', 'Maintenance Resolved',
    'Your maintenance request has been resolved.', 'MAINTENANCE', p_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 14. RPC FUNCTIONS — Phase 5 (Audits)
-- ============================================================

-- Open audit cycle (snapshot assets into audit_items)
CREATE OR REPLACE FUNCTION public.open_audit_cycle(p_cycle_id UUID)
RETURNS INTEGER AS $$
DECLARE
  cycle RECORD;
  caller_role public.user_role;
  item_count INTEGER;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'ADMIN' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO cycle FROM public.audit_cycles WHERE id = p_cycle_id FOR UPDATE;
  IF cycle.status != 'DRAFT' THEN RAISE EXCEPTION 'Cycle is not in DRAFT state'; END IF;

  -- Snapshot scoped assets into audit items
  IF cycle.scope_type = 'DEPARTMENT' THEN
    INSERT INTO public.audit_items (audit_cycle_id, asset_id)
    SELECT p_cycle_id, id FROM public.assets
    WHERE current_department_id = cycle.scope_id
      AND status NOT IN ('DISPOSED');
  ELSE
    INSERT INTO public.audit_items (audit_cycle_id, asset_id)
    SELECT p_cycle_id, id FROM public.assets
    WHERE location = (SELECT name FROM public.departments WHERE id = cycle.scope_id)
      AND status NOT IN ('DISPOSED');
  END IF;

  GET DIAGNOSTICS item_count = ROW_COUNT;

  UPDATE public.audit_cycles SET status = 'OPEN' WHERE id = p_cycle_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'AUDIT_OPENED', 'AUDIT', p_cycle_id,
    jsonb_build_object('items_created', item_count));

  RETURN item_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify audit item
CREATE OR REPLACE FUNCTION public.verify_audit_item(
  p_item_id UUID,
  p_result public.audit_result,
  p_notes TEXT DEFAULT NULL,
  p_evidence_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  item RECORD;
  cycle_status public.audit_cycle_status;
BEGIN
  SELECT ai.*, ac.status AS cycle_status INTO item
  FROM public.audit_items ai
  JOIN public.audit_cycles ac ON ac.id = ai.audit_cycle_id
  WHERE ai.id = p_item_id;

  IF item IS NULL THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  IF item.cycle_status != 'OPEN' THEN
    RAISE EXCEPTION 'AUDIT_CYCLE_CLOSED: Cannot edit items in a closed or draft cycle';
  END IF;

  -- Verify caller is assigned auditor
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_assignments
    WHERE audit_cycle_id = item.audit_cycle_id AND auditor_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Not assigned as auditor for this cycle';
  END IF;

  UPDATE public.audit_items
  SET result = p_result, notes = p_notes, evidence_url = p_evidence_url,
      verified_by = auth.uid(), verified_at = now()
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Close audit cycle
CREATE OR REPLACE FUNCTION public.close_audit_cycle(p_cycle_id UUID)
RETURNS JSONB AS $$
DECLARE
  caller_role public.user_role;
  cycle RECORD;
  discrepancies JSONB;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'ADMIN' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO cycle FROM public.audit_cycles WHERE id = p_cycle_id FOR UPDATE;
  IF cycle.status != 'OPEN' THEN RAISE EXCEPTION 'Cycle is not OPEN'; END IF;

  -- Generate discrepancy report
  SELECT jsonb_agg(jsonb_build_object(
    'item_id', ai.id,
    'asset_id', ai.asset_id,
    'asset_tag', a.asset_tag,
    'asset_name', a.name,
    'result', ai.result::text,
    'notes', ai.notes
  )) INTO discrepancies
  FROM public.audit_items ai
  JOIN public.assets a ON a.id = ai.asset_id
  WHERE ai.audit_cycle_id = p_cycle_id
    AND ai.result IN ('MISSING', 'DAMAGED');

  -- Mark confirmed missing assets as LOST
  UPDATE public.assets SET status = 'LOST', updated_at = now()
  WHERE id IN (
    SELECT asset_id FROM public.audit_items
    WHERE audit_cycle_id = p_cycle_id AND result = 'MISSING'
  ) AND status != 'DISPOSED';

  -- Close the cycle
  UPDATE public.audit_cycles
  SET status = 'CLOSED', closed_by = auth.uid(), closed_at = now()
  WHERE id = p_cycle_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'AUDIT_CLOSED', 'AUDIT', p_cycle_id,
    jsonb_build_object('discrepancy_count', COALESCE(jsonb_array_length(discrepancies), 0)));

  RETURN COALESCE(discrepancies, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dashboard KPIs (role-scoped)
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


-- ============================================================
-- 15. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---- DEPARTMENTS ----
CREATE POLICY "departments_select" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "departments_insert" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "departments_update" ON public.departments
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- ---- ASSET CATEGORIES ----
CREATE POLICY "categories_select" ON public.asset_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_insert" ON public.asset_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "categories_update" ON public.asset_categories
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- ---- ACTIVITY LOGS (read-only) ----
CREATE POLICY "logs_select" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "logs_insert" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ---- ASSETS ----
CREATE POLICY "assets_select" ON public.assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assets_insert" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'));

CREATE POLICY "assets_update" ON public.assets
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- ---- ASSET ATTACHMENTS ----
CREATE POLICY "attachments_select" ON public.asset_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "attachments_insert" ON public.asset_attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- ---- ALLOCATIONS ----
CREATE POLICY "allocations_select" ON public.allocations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allocations_insert" ON public.allocations
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'));

CREATE POLICY "allocations_update" ON public.allocations
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- ---- TRANSFER REQUESTS ----
CREATE POLICY "transfers_select" ON public.transfer_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "transfers_insert" ON public.transfer_requests
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "transfers_update" ON public.transfer_requests
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'));

-- ---- BOOKINGS ----
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER')
  );

-- ---- MAINTENANCE REQUESTS ----
CREATE POLICY "maintenance_select" ON public.maintenance_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "maintenance_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "maintenance_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- ---- AUDIT CYCLES ----
CREATE POLICY "audit_cycles_select" ON public.audit_cycles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_cycles_insert" ON public.audit_cycles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

CREATE POLICY "audit_cycles_update" ON public.audit_cycles
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'ADMIN');

-- ---- AUDIT ASSIGNMENTS ----
CREATE POLICY "audit_assignments_select" ON public.audit_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_assignments_insert" ON public.audit_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- ---- AUDIT ITEMS ----
CREATE POLICY "audit_items_select" ON public.audit_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_items_update" ON public.audit_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_assignments
      WHERE audit_cycle_id = audit_items.audit_cycle_id
        AND auditor_id = auth.uid()
    )
    OR public.get_my_role() = 'ADMIN'
  );

-- ---- NOTIFICATIONS ----
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- 16. OVERDUE ALLOCATIONS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.overdue_allocations AS
SELECT
  a.id AS allocation_id,
  a.asset_id,
  ast.name AS asset_name,
  ast.asset_tag,
  a.holder_type,
  a.holder_id,
  p.name AS holder_name,
  p.email AS holder_email,
  a.allocated_at,
  a.expected_return_at,
  now() - a.expected_return_at AS overdue_by
FROM public.allocations a
JOIN public.assets ast ON a.asset_id = ast.id
JOIN public.profiles p ON a.holder_id = p.id
WHERE a.status = 'ACTIVE'
  AND a.expected_return_at IS NOT NULL
  AND a.expected_return_at < now()
  AND a.returned_at IS NULL;


-- ============================================================
-- 17. ENABLE REALTIME on notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ============================================================
-- Done! All tables, functions, policies, and views created.
-- ============================================================
