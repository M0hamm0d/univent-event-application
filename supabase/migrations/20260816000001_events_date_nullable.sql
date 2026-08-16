-- Allow events to be created/edited without a date when the organizer picks
-- "I'm not sure about the date yet" (events.date_not_fixed = true).
--
-- Previously `events.date` was NOT NULL, which silently rejected undated events
-- at the DB layer even after the frontend stopped requiring the date. We make
-- the column nullable and add an integrity CHECK so a row must EITHER be
-- explicitly undated (date_not_fixed = true) OR carry an actual date — it can
-- never have both null. Matches the existing column names:
--   events.date            (date, was NOT NULL)
--   events.date_not_fixed  (boolean, NOT NULL, default false)
-- Idempotent.

ALTER TABLE events ALTER COLUMN date DROP NOT NULL;

-- Drop any prior copy so re-running stays safe (CREATE CONSTRAINT IF NOT
-- EXISTS isn't supported for a table CHECK, so guard with DO + information).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_date_or_not_fixed_chk'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_date_or_not_fixed_chk
      CHECK (date_not_fixed = true OR date IS NOT NULL);
  END IF;
END $$;