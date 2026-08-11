-- UniVent Registration System — Stage 6A: custom form RPCs
-- Run after 20260809000007_registration_form_bucket.sql.
-- Idempotent (CREATE OR REPLACE).
--
-- Goals (per the approved Stage 6 architecture):
--   1. Single source of capacity/waitlist logic. Extract the body of the
--      existing register_for_event into an internal worker _register_user, and
--      make register_for_event a one-line wrapper. The custom-form path
--      (register_with_form) calls the SAME worker, so capacity rules are never
--      duplicated. Both paths return the identical status contract.
--   2. Backward compatibility. register_for_event keeps its exact signature and
--      return contract; MODE 1 (no-form) events behave byte-for-byte the same.
--   3. Identity from auth.uid(). The new RPCs derive the caller from
--      auth.uid() rather than trusting a client-supplied p_user_id. As a
--      defensive hardening of the existing register_for_event (whose
--      SECURITY DEFINER body previously bypassed RLS and would have accepted
--      any p_user_id), it now refuses to register anyone other than the caller.
--      This only affects impersonation attempts — honest clients already pass
--      their own uid.
--   4. Atomicity. register_with_form validates the form, calls _register_user,
--      and upserts the response all inside one SECURITY DEFINER transaction.
--      A response-insert failure rolls back the registration insert; a
--      registration failure prevents the response insert. No orphan in either
--      direction.
--   5. Editable responses. update_form_response re-validates and updates the
--      response row only; it never touches registered_events/waiting_list, so
--      it cannot change status or waitlist position. It also enforces that
--      registration is still open (form published, capacity != 0 closed flag,
--      event not yet started).
--   6. cancel_registration / get_event_attendees are intentionally UNCHANGED.
--      Waitlist promotion deletes the waiting_list row and inserts a
--      registered_events row keyed on (event_id, user_id); the response row is
--      keyed on the same (event_id, user_id) and therefore stays attached with
--      zero plumbing.
--
-- Helper RPCs (_register_user, _validate_form_answers, _extract_file_paths)
-- have EXECUTE revoked from PUBLIC/anon/authenticated so they cannot be called
-- directly via PostgREST; only the public RPCs may invoke them.

-- ============================================================================
-- _register_user(p_event_id, p_user_id)  [INTERNAL]
--   The single authoritative capacity/waitlist implementation. Returns jsonb:
--     { status: 'registered' | 'waitlisted' | 'already_registered' |
--               'already_waitlisted' | 'closed', position?: int }
--   Rules (identical to the previous register_for_event, extracted verbatim):
--     - SELECT events ... FOR UPDATE serializes concurrent callers
--     - requires_registration must be true
--     - duplicate-registered and duplicate-waitlist guards
--     - capacity IS NULL -> unlimited (always registers)
--     - capacity = 0     -> 'closed' (no rows written)
--     - count < capacity -> INSERT registered_events('registered')
--     - else            -> INSERT waiting_list, return position
-- ============================================================================
CREATE OR REPLACE FUNCTION _register_user(p_event_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event          RECORD;
  v_registered_cnt int;
  v_existing_reg   uuid;
  v_existing_wait  uuid;
  v_existing_cancel uuid;
  v_position       int;
BEGIN
  SELECT capacity, requires_registration
    INTO v_event
  FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT v_event.requires_registration THEN
    RAISE EXCEPTION 'This event does not require registration';
  END IF;

  SELECT id INTO v_existing_reg
  FROM registered_events
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'registered'
  LIMIT 1;
  IF v_existing_reg IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_registered');
  END IF;

  SELECT id INTO v_existing_wait
  FROM waiting_list
  WHERE event_id = p_event_id AND user_id = p_user_id
  LIMIT 1;
  IF v_existing_wait IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_waitlisted');
  END IF;

  IF v_event.capacity = 0 THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;

  SELECT count(*) INTO v_registered_cnt
  FROM registered_events
  WHERE event_id = p_event_id AND status = 'registered';

  IF v_event.capacity IS NULL OR v_registered_cnt < v_event.capacity THEN
    -- Reactivate a previously-cancelled row if one exists (cancel-then-resubmit
    -- case). The unique index on (event_id, user_id) means we can't INSERT a
    -- second row, so UPDATE the cancelled one back to 'registered' instead.
    SELECT id INTO v_existing_cancel
    FROM registered_events
    WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'cancelled'
    LIMIT 1;
    IF v_existing_cancel IS NOT NULL THEN
      UPDATE registered_events
        SET status = 'registered', registered_at = now()
        WHERE id = v_existing_cancel;
    ELSE
      INSERT INTO registered_events (user_id, event_id, status)
      VALUES (p_user_id, p_event_id, 'registered');
    END IF;
    RETURN jsonb_build_object('status', 'registered');
  END IF;

  INSERT INTO waiting_list (user_id, event_id) VALUES (p_user_id, p_event_id);
  SELECT count(*) INTO v_position FROM waiting_list WHERE event_id = p_event_id;
  RETURN jsonb_build_object('status', 'waitlisted', 'position', v_position);
END;
$$;

REVOKE EXECUTE ON FUNCTION _register_user(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- register_for_event(p_event_id, p_user_id)  [REFACTORED WRAPPER]
--   Backward compatible: same signature, same return contract. Now delegates to
--   _register_user so capacity logic lives in one place. Defense-in-depth: it
--   refuses to register a user_id other than the caller (auth.uid()), which only
--   affects impersonation attempts; honest clients always pass their own uid.
-- ============================================================================
CREATE OR REPLACE FUNCTION register_for_event(p_event_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only register yourself';
  END IF;
  RETURN _register_user(p_event_id, p_user_id);
END;
$$;

-- ============================================================================
-- _validate_form_answers(p_fields, p_answers, p_event_id)  [INTERNAL]
--   Validates raw client answers against the field definitions of a published
--   version. Returns a cleaned jsonb object containing ONLY known field keys
--   with type/option/required checks applied. Raises on any violation.
--   File/image answers must be storage paths of the form
--   {auth.uid()}/{p_event_id}/... and the object must exist in the private
--   registration-form-uploads bucket (existence is checked via storage.objects
--   using SECURITY DEFINER, which bypasses storage RLS).
--   Options are treated as arrays of strings (v1 field def shape).
-- ============================================================================
CREATE OR REPLACE FUNCTION _validate_form_answers(p_fields jsonb, p_answers jsonb, p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field         jsonb;
  v_key           text;
  v_type          text;
  v_required      boolean;
  v_options       jsonb;
  v_val           jsonb;
  v_clean         jsonb := '{}'::jsonb;
  v_str           text;
  v_trimmed       text;
  v_num           numeric;
  v_item          jsonb;
  v_arr           jsonb;
  v_prefix        text;
  v_date          date;
  v_owner         text;
  v_max_text_len  int := 16000;     -- per text/textarea/email/phone answer cap
  v_max_arr_items int := 100;       -- checkbox max selected items
  v_max_fields    int := 200;       -- publishable field count cap
  v_max_payload   int := 262144;    -- 256KB total answers payload cap
BEGIN
  IF p_answers IS NULL THEN p_answers := '{}'::jsonb; END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Form answers must be a JSON object';
  END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Form fields must be a JSON array';
  END IF;
  -- Total payload size cap (defense-in-depth against DoS / storage abuse).
  IF octet_length(p_answers::text) > v_max_payload THEN
    RAISE EXCEPTION 'Form answers payload is too large (max % bytes)', v_max_payload;
  END IF;
  -- Field count cap (a maliciously huge published form could blow up the loop).
  IF jsonb_array_length(p_fields) > v_max_fields THEN
    RAISE EXCEPTION 'Form has too many fields (max %)', v_max_fields;
  END IF;

  v_owner := auth.uid()::text;
  v_prefix := v_owner || '/' || p_event_id::text || '/';

  FOR v_field IN SELECT jsonb_array_elements(p_fields) LOOP
    v_key      := v_field->>'key';
    v_type     := v_field->>'type';
    v_required := COALESCE((v_field->>'required')::boolean, false);
    v_options  := v_field->'options';
    v_val      := p_answers->v_key;

    IF v_key IS NULL THEN
      RAISE EXCEPTION 'Form field is missing a key';
    END IF;

    -- Required / empty checks (before type coercion).
    IF v_required THEN
      IF v_val IS NULL
         OR (jsonb_typeof(v_val) = 'string' AND btrim(v_val#>>'{}') = '')
         OR (jsonb_typeof(v_val) = 'array' AND jsonb_array_length(v_val) = 0) THEN
        RAISE EXCEPTION 'Required field "%" is missing or empty', v_key;
      END IF;
    ELSE
      IF v_val IS NULL THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(v_val) = 'string' AND btrim(v_val#>>'{}') = '' THEN
        CONTINUE;
      END IF;
      IF jsonb_typeof(v_val) = 'array' AND jsonb_array_length(v_val) = 0 THEN
        CONTINUE;
      END IF;
    END IF;

    CASE v_type
      WHEN 'text', 'textarea' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Field "%" must be text', v_key;
        END IF;
        IF length(v_val#>>'{}') > v_max_text_len THEN
          RAISE EXCEPTION 'Field "%" is too long (max % characters)', v_key, v_max_text_len;
        END IF;
        v_clean := v_clean || jsonb_build_object(v_key, v_val);

      WHEN 'email' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Field "%" must be a text email', v_key;
        END IF;
        v_trimmed := btrim(v_val#>>'{}');
        IF length(v_trimmed) > 320 THEN
          RAISE EXCEPTION 'Field "%" is too long for an email', v_key;
        END IF;
        IF v_trimmed !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
          RAISE EXCEPTION 'Field "%" is not a valid email address', v_key;
        END IF;
        v_clean := v_clean || jsonb_build_object(v_key, v_trimmed);

      WHEN 'phone' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Field "%" must be a text phone number', v_key;
        END IF;
        IF length(v_val#>>'{}') > v_max_text_len THEN
          RAISE EXCEPTION 'Field "%" is too long', v_key;
        END IF;
        v_str := regexp_replace((v_val#>>'{}'), '[+\-()\s]', '', 'g');
        IF v_str !~ '^[0-9]+$' OR length(v_str) < 5 OR length(v_str) > 30 THEN
          RAISE EXCEPTION 'Field "%" is not a valid phone number', v_key;
        END IF;
        v_clean := v_clean || jsonb_build_object(v_key, v_val);

      WHEN 'number' THEN
        IF jsonb_typeof(v_val) = 'number' THEN
          v_num := (v_val)::numeric;
        ELSIF jsonb_typeof(v_val) = 'string' THEN
          BEGIN
            v_num := (v_val#>>'{}')::numeric;
          EXCEPTION WHEN others THEN
            RAISE EXCEPTION 'Field "%" is not a valid number', v_key;
          END;
        ELSE
          RAISE EXCEPTION 'Field "%" must be a number', v_key;
        END IF;
        IF (v_field->'validation'->>'min') IS NOT NULL
           AND v_num < (v_field->'validation'->>'min')::numeric THEN
          RAISE EXCEPTION 'Field "%" is below the minimum', v_key;
        END IF;
        IF (v_field->'validation'->>'max') IS NOT NULL
           AND v_num > (v_field->'validation'->>'max')::numeric THEN
          RAISE EXCEPTION 'Field "%" is above the maximum', v_key;
        END IF;
        v_clean := v_clean || jsonb_build_object(v_key, to_jsonb(v_num));

      WHEN 'radio', 'select' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Field "%" must select one option', v_key;
        END IF;
        IF v_options IS NULL OR jsonb_typeof(v_options) IS DISTINCT FROM 'array'
           OR NOT (v_options @> jsonb_build_array(v_val)) THEN
          RAISE EXCEPTION 'Field "%" selected an invalid option', v_key;
        END IF;
        v_clean := v_clean || jsonb_build_object(v_key, v_val);

      WHEN 'checkbox' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'Field "%" must be an array of options', v_key;
        END IF;
        IF jsonb_array_length(v_val) > v_max_arr_items THEN
          RAISE EXCEPTION 'Field "%" has too many selected options (max %)', v_key, v_max_arr_items;
        END IF;
        IF v_options IS NULL OR jsonb_typeof(v_options) IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'Field "%" has no configured options', v_key;
        END IF;
        v_arr := '[]'::jsonb;
        FOR v_item IN SELECT jsonb_array_elements(v_val) LOOP
          IF NOT (v_options @> jsonb_build_array(v_item)) THEN
            RAISE EXCEPTION 'Field "%" selected an invalid option', v_key;
          END IF;
          v_arr := v_arr || jsonb_build_array(v_item);
        END LOOP;
        v_clean := v_clean || jsonb_build_object(v_key, v_arr);

      WHEN 'date' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Field "%" must be a date string', v_key;
        END IF;
        BEGIN
          v_date := (v_val#>>'{}')::date;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Field "%" is not a valid date', v_key;
        END;
        v_clean := v_clean || jsonb_build_object(v_key, to_char(v_date, 'YYYY-MM-DD'));

      WHEN 'file', 'image' THEN
        IF jsonb_typeof(v_val) IS DISTINCT FROM 'string' THEN
          RAISE EXCEPTION 'Field "%" must be a file path', v_key;
        END IF;
        v_str := v_val#>>'{}';
        IF v_str = '' THEN
          IF v_required THEN
            RAISE EXCEPTION 'Required field "%" is missing a file', v_key;
          END IF;
          CONTINUE;
        END IF;
        IF position(v_prefix in v_str) <> 1 THEN
          RAISE EXCEPTION 'File "%" is not in your upload folder', v_str;
        END IF;
        PERFORM 1 FROM storage.objects
          WHERE bucket_id = 'registration-form-uploads' AND name = v_str;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'File "%" not found in storage', v_str;
        END IF;
        v_clean := v_clean || jsonb_build_object(v_key, v_str);

      ELSE
        RAISE EXCEPTION 'Unknown field type "%" for field "%"', v_type, v_key;
    END CASE;
  END LOOP;

  RETURN v_clean;
END;
$$;

REVOKE EXECUTE ON FUNCTION _validate_form_answers(jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- _extract_file_paths(p_fields, p_answers)  [INTERNAL]
--   Returns the set of file/image answer paths from a response's answers using
--   the SAME field defs that defined them (so only real file fields are read).
--   Used by update_form_response to compute which previously-referenced files
--   are no longer referenced and may be removed from storage.
-- ============================================================================
CREATE OR REPLACE FUNCTION _extract_file_paths(p_fields jsonb, p_answers jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field  jsonb;
  v_key    text;
  v_type   text;
  v_val    jsonb;
  v_paths  text[] := ARRAY[]::text[];
  v_str    text;
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'array' THEN
    RETURN v_paths;
  END IF;
  IF p_answers IS NULL THEN
    RETURN v_paths;
  END IF;

  FOR v_field IN SELECT jsonb_array_elements(p_fields) LOOP
    v_type := v_field->>'type';
    v_key  := v_field->>'key';
    IF v_type IN ('file','image') AND v_key IS NOT NULL THEN
      v_val := p_answers->v_key;
      IF v_val IS NOT NULL AND jsonb_typeof(v_val) = 'string' THEN
        v_str := v_val#>>'{}';
        IF v_str <> '' THEN
          v_paths := array_append(v_paths, v_str);
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_paths;
END;
$$;

REVOKE EXECUTE ON FUNCTION _extract_file_paths(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- register_with_form(p_event_id, p_form_version_id, p_form_data)
--   Student path for events that have a published custom form. Derives the user
--   from auth.uid(). Validates the form answers against the CURRENT published
--   version, then atomically:
--     - calls _register_user (capacity/waitlist decision)
--     - if registered or waitlisted, UPSERTs the registration_form_responses row
--   Everything runs in one SECURITY DEFINER transaction -> no orphan possible.
--   Returns the same status contract as register_for_event, plus form_version_id:
--     { status, position?, form_version_id }
--   Returns { status: 'form_outdated' } if p_form_version_id is supplied but no
--   longer matches the form's current published version (the client should
--   refresh the form and refill).
-- ============================================================================
CREATE OR REPLACE FUNCTION register_with_form(
  p_event_id        uuid,
  p_form_version_id uuid,
  p_form_data       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_form     registration_forms%ROWTYPE;
  v_version  registration_form_versions%ROWTYPE;
  v_clean    jsonb;
  v_result   jsonb;
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

  -- If the client supplied a version id, it must match the active one.
  IF p_form_version_id IS NOT NULL
     AND p_form_version_id IS DISTINCT FROM v_form.current_version_id THEN
    RETURN jsonb_build_object('status', 'form_outdated');
  END IF;

  SELECT * INTO v_version
  FROM registration_form_versions
  WHERE id = v_form.current_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Published form version not found';
  END IF;

  -- Validate (raises with a clear message on any violation).
  v_clean := _validate_form_answers(v_version.fields, p_form_data, p_event_id);

  -- Atomic capacity/waitlist decision (single source of truth).
  v_result := _register_user(p_event_id, v_user);

  -- Persist the form response only when a registration/waitlist action
  -- actually happened. (already_registered / already_waitlisted / closed keep
  -- whatever response already exists; we do not overwrite it here.)
  IF (v_result->>'status') IN ('registered','waitlisted') THEN
    INSERT INTO registration_form_responses
      (event_id, user_id, form_id, form_version_id, answers)
    VALUES (p_event_id, v_user, v_form.id, v_version.id, v_clean)
    ON CONFLICT (event_id, user_id) DO UPDATE
      SET answers         = EXCLUDED.answers,
          form_version_id = EXCLUDED.form_version_id,
          form_id         = EXCLUDED.form_id,
          updated_at      = now();
  END IF;

  RETURN v_result || jsonb_build_object('form_version_id', v_version.id);
END;
$$;

-- ============================================================================
-- update_form_response(p_event_id, p_form_data)
--   Lets a student EDIT their already-submitted answers. Derives the user from
--   auth.uid(). Enforces:
--     - the form is still published
--     - the event is not explicitly closed (capacity = 0)
--     - the event has not started (unless date_not_fixed)
--   It re-validates against the CURRENT published version and updates the
--   response's answers + form_version_id, then returns the previously-referenced
--   file paths that are no longer referenced so the client can remove them from
--   storage. It NEVER touches registered_events / waiting_list, so it cannot
--   affect status or waitlist position.
--   Returns: { success, removed_file_paths: [...] }
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

-- ============================================================================
-- publish_registration_form(p_form_id, p_fields)
--   Organizer path. Derives the organizer (auth.uid()) and verifies ownership.
--   Writes an IMMUTABLE row to registration_form_versions with the supplied
--   fields, bumps the version, sets registration_forms.current_version_id and
--   status='published'. Also mirrors the published fields into fields_draft so
--   the builder's draft reflects what just shipped.
--   Returns: { success, version_id, version }
-- ============================================================================
CREATE OR REPLACE FUNCTION publish_registration_form(p_form_id uuid, p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user            text := auth.uid()::text;
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

-- ============================================================================
-- get_active_registration_form(p_event_id)
--   Student/anon-safe read of the currently published form for an event.
--   Returns ONLY the published version fields + the form title/description. It
--   never exposes drafts, other versions, or organizer-only data. Anonymous
--   browsing may call this to render the form before the auth wall; the actual
--   submission still requires auth via register_with_form.
--   Returns:
--     { event_id, form_id, title, description, form_version_id, fields }
--     or NULL (no row) if the event has no custom form or it is not published.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_registration_form(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form    registration_forms%ROWTYPE;
  v_version registration_form_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_form FROM registration_forms WHERE event_id = p_event_id;
  IF NOT FOUND OR v_form.status IS DISTINCT FROM 'published'
     OR v_form.current_version_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_version
  FROM registration_form_versions
  WHERE id = v_form.current_version_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'form_id', v_form.id,
    'title', v_form.title,
    'description', v_form.description,
    'form_version_id', v_version.id,
    'fields', v_version.fields
  );
END;
$$;

-- ============================================================================
-- get_form_response_for_user(p_event_id)
--   Student reads their OWN already-submitted response (to pre-fill the editor).
--   Derives user from auth.uid() and returns only the caller's row, joined with
--   the version fields the answers were submitted against so the client can
--   render labels/options correctly. Returns NULL if the caller has not
--   submitted yet for this event.
--   Returns:
--     { event_id, form_id, form_version_id, answers, submitted_at, updated_at,
--       fields }
-- ============================================================================
CREATE OR REPLACE FUNCTION get_form_response_for_user(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_resp     registration_form_responses%ROWTYPE;
  v_version  registration_form_versions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_resp FROM registration_form_responses
  WHERE event_id = p_event_id AND user_id = v_user;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_version
  FROM registration_form_versions
  WHERE id = v_resp.form_version_id;

  RETURN jsonb_build_object(
    'event_id', v_resp.event_id,
    'form_id', v_resp.form_id,
    'form_version_id', v_resp.form_version_id,
    'answers', v_resp.answers,
    'submitted_at', v_resp.submitted_at,
    'updated_at', v_resp.updated_at,
    'fields', v_version.fields
  );
END;
$$;

-- ============================================================================
-- get_event_form_responses(p_event_id)
--   Organizer-only. Returns every submitted response for the event, joined with
--   profile (name/email/pic) AND the registration/waitlist state, plus the
--   version fields the response was submitted against so each attendee's
--   answers can be rendered with the labels/options that were active when they
--   submitted. This is a NEW RPC (get_event_attendees is unchanged) so the
--   existing attendee view has zero risk.
--   Returns:
--     { event_id, form_id, current_version_id,
--       responses: [ { user_id, user_name, user_email, profile_pics,
--                       registration_status, registered_at, waitlisted_at,
--                       waitlist_position, form_version_id, form_version_fields,
--                       answers, submitted_at, updated_at } ... ] }
-- ============================================================================
CREATE OR REPLACE FUNCTION get_event_form_responses(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_form  registration_forms%ROWTYPE;
BEGIN
  SELECT user_id INTO v_owner FROM events WHERE id = p_event_id;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to view attendees for this event';
  END IF;

  SELECT * INTO v_form FROM registration_forms WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'event_id', p_event_id,
      'form_id', NULL,
      'current_version_id', NULL,
      'responses', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'form_id', v_form.id,
    'current_version_id', v_form.current_version_id,
    'responses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',              r.user_id,
        'user_name',            p.user_name,
        'user_email',           p.user_email,
        'profile_pics',        p.profile_pics,
        'registration_status',  COALESCE(re.status, 'none'),
        'registered_at',        re.registered_at,
        'waitlisted_at',        wl.created_at,
        'waitlist_position',    CASE
                                   WHEN wl.id IS NOT NULL THEN (
                                     SELECT count(*) FROM waiting_list x
                                     WHERE x.event_id = p_event_id
                                       AND x.created_at <= wl.created_at
                                   )
                                   ELSE NULL
                                 END,
        'form_version_id',      r.form_version_id,
        'form_version_fields',  v.fields,
        'answers',              r.answers,
        'submitted_at',         r.submitted_at,
        'updated_at',           r.updated_at
      ) ORDER BY r.submitted_at ASC)
      FROM registration_form_responses r
      JOIN profile p ON p.id = r.user_id
      LEFT JOIN registered_events re
        ON re.event_id = r.event_id AND re.user_id = r.user_id
      LEFT JOIN waiting_list wl
        ON wl.event_id = r.event_id AND wl.user_id = r.user_id
      LEFT JOIN registration_form_versions v
        ON v.id = r.form_version_id
      WHERE r.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;