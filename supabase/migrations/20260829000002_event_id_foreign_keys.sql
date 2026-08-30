-- UniVent Security Hardening — Stage 2: referential integrity for event_id FKs.
--
-- Background: registered_events, waiting_list, and interested_events had NO
-- foreign key to events(id). Deleting an event left orphaned registration /
-- waitlist / interest rows. registration_forms and registration_form_responses
-- already FK events(id) ON DELETE CASCADE (migration 20260809000005); this
-- brings the three legacy tables to the same integrity guarantee.
--
-- Both sides of these FKs are already uuid (events.id, *.event_id), so this
-- migration is independent of the events.user_id text->uuid type change in
-- Stage 3. Safe to apply first.
--
-- Idempotent: guarded with IF NOT EXISTS via DO blocks. Orphaned rows (pointing
-- at deleted events) are removed BEFORE adding the FK so the constraint can be
-- created; a report of removed rows is logged.

-- ---------------------------------------------------------------------------
-- 1. Remove orphaned rows that would block the FK constraints.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_removed int;
BEGIN
  DELETE FROM registered_events re
    WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = re.event_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % orphaned registered_events rows', v_removed;

  DELETE FROM waiting_list wl
    WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = wl.event_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % orphaned waiting_list rows', v_removed;

  DELETE FROM interested_events ie
    WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.id = ie.event_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % orphaned interested_events rows', v_removed;
END $$;

-- ---------------------------------------------------------------------------
-- 2. registered_events.event_id -> events(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'registered_events_event_id_fkey'
      AND table_name = 'registered_events'
  ) THEN
    ALTER TABLE registered_events
      ADD CONSTRAINT registered_events_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK registered_events.event_id -> events(id)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. waiting_list.event_id -> events(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'waiting_list_event_id_fkey'
      AND table_name = 'waiting_list'
  ) THEN
    ALTER TABLE waiting_list
      ADD CONSTRAINT waiting_list_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK waiting_list.event_id -> events(id)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. interested_events.event_id -> events(id) ON DELETE CASCADE
--    (interested_events is a pre-existing table not created by any migration in
--    this repo; its event_id column is assumed uuid based on frontend usage.
--    If the column is not uuid, this will error safely and should be resolved
--    by altering its type first.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'interested_events_event_id_fkey'
      AND table_name = 'interested_events'
  ) THEN
    ALTER TABLE interested_events
      ADD CONSTRAINT interested_events_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK interested_events.event_id -> events(id)';
  END IF;
END $$;
