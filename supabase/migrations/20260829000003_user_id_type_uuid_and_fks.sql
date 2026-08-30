-- UniVent Security Hardening — Stage 3: reconcile user_id types (text -> uuid).
--
-- Background: events.user_id and registration_forms.organizer_id are text, while
-- registered_events.user_id / waiting_list.user_id / registration_form_responses
-- .user_id are uuid. RLS policies on the legacy tables cast auth.uid()::text to
-- compare, and several RPCs do the same. This is brittle and blocks adding
-- proper foreign keys from the user_id columns to auth.users(id) (which is uuid).
--
-- This migration:
--   1. Pre-checks that every events.user_id and registration_forms.organizer_id
--      value is a valid UUID string (aborts safely if any are not).
--   2. Drops the dependent RLS policies and the organizer_id index.
--   3. Alters events.user_id and registration_forms.organizer_id to uuid.
--   4. Recreates the index and RLS policies using auth.uid() directly (no cast).
--   5. Recreates publish_registration_form (which compared organizer_id to
--      auth.uid()::text) so it compares uuids.
--   6. Adds user_id foreign keys to auth.users(id) ON DELETE CASCADE for
--      registered_events, waiting_list, interested_events (only if those
--      columns are uuid and have no orphans).
--
-- IMPORTANT: apply AFTER 20260829000002_event_id_foreign_keys.sql. Review the
-- NOTICE output; if the pre-check aborts, fix the offending rows and re-run.
-- Idempotent where possible (DO blocks, CREATE OR REPLACE).

-- ---------------------------------------------------------------------------
-- 0. Pre-check: all text user_id / organizer_id values must be valid UUIDs.
--    Abort the whole migration if any are not, so we never leave a half-migrated
--    schema. Supabase auth uids are UUIDs, so this should always pass for
--    honest data; it guards against stray test/junk rows.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_bad int;
BEGIN
  SELECT count(*) INTO v_bad
  FROM events
  WHERE user_id IS NOT NULL
    AND user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Aborting: % events.user_id values are not valid UUIDs. Fix them first.', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
  FROM registration_forms
  WHERE organizer_id IS NOT NULL
    AND organizer_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Aborting: % registration_forms.organizer_id values are not valid UUIDs. Fix them first.', v_bad;
  END IF;

  RAISE NOTICE 'Pre-check passed: all user_id/organizer_id values are valid UUIDs.';
END $$;

-- ---------------------------------------------------------------------------
-- 1. Drop dependent RLS policies (they reference auth.uid()::text).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "registered_events_self_select" ON registered_events;
DROP POLICY IF EXISTS "registered_events_self_insert" ON registered_events;
DROP POLICY IF EXISTS "registered_events_self_update" ON registered_events;
DROP POLICY IF EXISTS "registered_events_self_delete" ON registered_events;

DROP POLICY IF EXISTS "waiting_list_self_select" ON waiting_list;
DROP POLICY IF EXISTS "waiting_list_self_insert" ON waiting_list;
DROP POLICY IF EXISTS "waiting_list_self_delete" ON waiting_list;

DROP POLICY IF EXISTS "registration_forms_organizer_select" ON registration_forms;
DROP POLICY IF EXISTS "registration_forms_organizer_insert" ON registration_forms;
DROP POLICY IF EXISTS "registration_forms_organizer_update" ON registration_forms;
DROP POLICY IF EXISTS "registration_forms_organizer_delete" ON registration_forms;

DROP POLICY IF EXISTS "registration_form_versions_organizer_select" ON registration_form_versions;
DROP POLICY IF EXISTS "registration_form_versions_organizer_insert" ON registration_form_versions;

DROP POLICY IF EXISTS "registration_form_responses_self_or_organizer_select" ON registration_form_responses;
DROP POLICY IF EXISTS "registration_form_responses_self_insert" ON registration_form_responses;

-- Drop the organizer_id index (it's on a text column; recreate after type change).
DROP INDEX IF EXISTS registration_forms_organizer_idx;

-- ---------------------------------------------------------------------------
-- 2. Alter column types text -> uuid.
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

ALTER TABLE registration_forms
  ALTER COLUMN organizer_id TYPE uuid USING organizer_id::uuid;

-- ---------------------------------------------------------------------------
-- 3. Recreate the organizer_id index (now on uuid).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS registration_forms_organizer_idx
  ON registration_forms (organizer_id);

-- ---------------------------------------------------------------------------
-- 4. Recreate RLS policies using auth.uid() directly (no ::text cast).
-- ---------------------------------------------------------------------------

-- registered_events
CREATE POLICY "registered_events_self_select" ON registered_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registered_events.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "registered_events_self_insert" ON registered_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "registered_events_self_update" ON registered_events
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registered_events.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "registered_events_self_delete" ON registered_events
  FOR DELETE USING (user_id = auth.uid());

-- waiting_list
CREATE POLICY "waiting_list_self_select" ON waiting_list
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = waiting_list.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "waiting_list_self_insert" ON waiting_list
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "waiting_list_self_delete" ON waiting_list
  FOR DELETE USING (user_id = auth.uid());

-- registration_forms
CREATE POLICY "registration_forms_organizer_select" ON registration_forms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "registration_forms_organizer_insert" ON registration_forms
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "registration_forms_organizer_update" ON registration_forms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "registration_forms_organizer_delete" ON registration_forms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()
    )
  );

-- registration_form_versions
CREATE POLICY "registration_form_versions_organizer_select" ON registration_form_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registration_forms f
      WHERE f.id = registration_form_versions.form_id
        AND f.organizer_id = auth.uid()
    )
  );

CREATE POLICY "registration_form_versions_organizer_insert" ON registration_form_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM registration_forms f
      WHERE f.id = registration_form_versions.form_id
        AND f.organizer_id = auth.uid()
    )
  );

-- registration_form_responses
CREATE POLICY "registration_form_responses_self_or_organizer_select" ON registration_form_responses
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_form_responses.event_id
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "registration_form_responses_self_insert" ON registration_form_responses
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Recreate publish_registration_form so it compares uuids (not text).
--    The only change is v_user is now uuid := auth.uid() (was text).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION publish_registration_form(p_form_id uuid, p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user            uuid := auth.uid();
  v_form            registration_forms%ROWTYPE;
  v_next_version    int;
  v_new_version_id  uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_form FROM registration_forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found';
  END IF;
  IF v_form.organizer_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Not authorized to publish this form';
  END IF;

  IF p_fields IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_fields) = 0 THEN
    RAISE EXCEPTION 'Cannot publish a form with no fields';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM registration_form_versions WHERE form_id = p_form_id;

  INSERT INTO registration_form_versions (form_id, version, fields)
  VALUES (p_form_id, v_next_version, p_fields)
  RETURNING id INTO v_new_version_id;

  UPDATE registration_forms
    SET status             = 'published',
        current_version_id = v_new_version_id,
        fields_draft       = p_fields,
        updated_at         = now()
    WHERE id = p_form_id;

  RETURN jsonb_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version', v_next_version
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Add user_id foreign keys to auth.users(id) ON DELETE CASCADE.
--    Only for tables whose user_id is uuid (registered_events, waiting_list,
--    interested_events). Clean up orphaned rows first (users deleted from auth
--    but rows remain).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_removed int;
BEGIN
  -- registered_events
  DELETE FROM registered_events re
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = re.user_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % orphaned registered_events (no auth user)', v_removed;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'registered_events_user_id_fkey'
      AND table_name = 'registered_events'
  ) THEN
    ALTER TABLE registered_events
      ADD CONSTRAINT registered_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK registered_events.user_id -> auth.users(id)';
  END IF;

  -- waiting_list
  DELETE FROM waiting_list wl
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = wl.user_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % orphaned waiting_list (no auth user)', v_removed;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'waiting_list_user_id_fkey'
      AND table_name = 'waiting_list'
  ) THEN
    ALTER TABLE waiting_list
      ADD CONSTRAINT waiting_list_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK waiting_list.user_id -> auth.users(id)';
  END IF;

  -- interested_events (only if user_id is uuid; skip with notice if not)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interested_events' AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    DELETE FROM interested_events ie
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ie.user_id);
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed % orphaned interested_events (no auth user)', v_removed;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'interested_events_user_id_fkey'
        AND table_name = 'interested_events'
    ) THEN
      ALTER TABLE interested_events
        ADD CONSTRAINT interested_events_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added FK interested_events.user_id -> auth.users(id)';
    END IF;
  ELSE
    RAISE NOTICE 'Skipped interested_events.user_id FK (column is not uuid).';
  END IF;
END $$;
