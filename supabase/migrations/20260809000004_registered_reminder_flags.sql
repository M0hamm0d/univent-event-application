-- UniVent Registration System — reminder tracking for registered attendees.
-- Adds a_day_email / an_hr_email flags to registered_events so the daily
-- reminder cron (/api/reminder) can also notify registered attendees (not just
-- interested_events users) without resending.
-- Idempotent.

ALTER TABLE registered_events
  ADD COLUMN IF NOT EXISTS a_day_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS an_hr_email boolean NOT NULL DEFAULT false;