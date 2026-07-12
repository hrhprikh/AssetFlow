-- Enable the pg_cron extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the function that will process reminders
CREATE OR REPLACE FUNCTION public.process_booking_reminders()
RETURNS void AS $$
DECLARE
  v_booking record;
  v_notification_id uuid;
BEGIN
  -- Find bookings that:
  -- 1. Are UPCOMING
  -- 2. Start within the next 1 hour (but are still in the future)
  -- 3. Haven't had a reminder sent yet
  FOR v_booking IN
    SELECT b.id, b.requester_id, b.start_at, a.name as asset_name
    FROM public.bookings b
    JOIN public.assets a ON a.id = b.asset_id
    WHERE b.status = 'UPCOMING'
      AND b.start_at > now()
      AND b.start_at <= (now() + interval '1 hour')
      AND b.reminder_sent_at IS NULL
  LOOP
    -- Insert a notification for the requester
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (
      v_booking.requester_id,
      'BOOKING_REMINDER',
      'Upcoming Booking Reminder',
      'Your booking for ' || v_booking.asset_name || ' starts in less than an hour at ' || to_char(v_booking.start_at, 'HH24:MI'),
      'BOOKING',
      v_booking.id
    );

    -- Update the booking to mark the reminder as sent
    UPDATE public.bookings
    SET reminder_sent_at = now()
    WHERE id = v_booking.id;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the cron job to run every 15 minutes
-- First, unschedule if it already exists to prevent duplicates
SELECT cron.unschedule('booking-reminders');

-- Then schedule it
SELECT cron.schedule(
  'booking-reminders',
  '*/15 * * * *',
  $$ SELECT public.process_booking_reminders(); $$
);
