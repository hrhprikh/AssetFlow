-- STEP 1: Add new enum values to booking_status
-- NOTE: Run this file FIRST and click "Run". 
-- After it succeeds, open and run update_bookings_step2.sql

COMMIT;
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'UPCOMING';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'REJECTED' AFTER 'CANCELLED';
