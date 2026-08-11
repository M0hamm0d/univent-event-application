-- ============================================================================
-- Fix: update_form_response crashed at runtime with
--   "COALESCE types text and time without time zone cannot be matched"
-- because events.time is a text column (stores 'HH:MM' or ''). The original
-- migration 20260809000008 used COALESCE(e.time, '23:59:59'::time) which has
-- no common type between text and time. NULLIF(e.time,'')::time normalizes
-- empty strings to NULL before the cast, and gives COALESCE two time-typed
-- args. This re-issues the full CREATE OR REPLACE so remote (where the buggy
-- version is already live) gets the fix via `supabase db push`.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_form_response(p_event_id uuid, p_form_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        uuid := auth.uid();
  v_form        registration_forms%ROWTYPE;
  v_version     registration_form_versions%ROWTYPE;
  v_existing    registration_form_responses%ROWTYPE;
  v_clean       jsonb;
  v_old_paths   text[];
  v_new_paths   text[];
  v_removed     text[];
  v_old_fields  jsonb;
  v_path        text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_form FROM registration_forms WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This event does not have a custom form';
  END IF;
  IF v_form.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Registration for this event is not open';
  END IF;
  IF v_form.current_version_id IS NULL THEN
    RAISE EXCEPTION 'No published form version is available';
  END IF;

  -- Event-level "registration closed" checks.
  PERFORM 1 FROM events e
  WHERE e.id = p_event_id
    AND e.capacity IS DISTINCT FROM 0
    AND (
      COALESCE(e.date_not_fixed, false) IS true
      OR e.date IS NULL
      OR (e.date + COALESCE(NULLIF(e.time, '')::time, '23:59:59'::time)) > now()
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration for this event is closed';
  END IF;

  SELECT * INTO v_existing FROM registration_form_responses
  WHERE event_id = p_event_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existing form response to edit';
  END IF;

  SELECT * INTO v_version
  FROM registration_form_versions
  WHERE id = v_form.current_version_id;

  v_clean := _validate_form_answers(v_version.fields, p_form_data, p_event_id);

  -- Compute orphan file diff using the version the OLD answers were submitted
  -- against (so we only collect real file fields from that snapshot).
  SELECT fields INTO v_old_fields
  FROM registration_form_versions
  WHERE id = v_existing.form_version_id;
  IF v_old_fields IS NULL THEN
    v_old_paths := ARRAY[]::text[];
  ELSE
    v_old_paths := _extract_file_paths(v_old_fields, v_existing.answers);
  END IF;
  v_new_paths := _extract_file_paths(v_version.fields, v_clean);

  v_removed := ARRAY[]::text[];
  IF array_length(v_old_paths, 1) IS NOT NULL THEN
    FOREACH v_path IN ARRAY v_old_paths LOOP
      IF COALESCE(array_position(v_new_paths, v_path), 0) = 0 THEN
        v_removed := array_append(v_removed, v_path);
      END IF;
    END LOOP;
  END IF;

  UPDATE registration_form_responses
    SET answers         = v_clean,
        form_version_id = v_version.id,
        updated_at      = now()
    WHERE event_id = p_event_id AND user_id = v_user;

  RETURN jsonb_build_object(
    'success', true,
    'form_version_id', v_version.id,
    'removed_file_paths', to_jsonb(v_removed)
  );
END;
$$;