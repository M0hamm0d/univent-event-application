-- UniVent Registration System — Stage 10: unregister fully resets a student.
-- Re-issues cancel_registration so that unregistering:
--   * hard-deletes the registered_events row (no cancelled-status history row),
--   * hard-deletes the student's registration_form_responses row (so a future
--     re-registration presents the custom form from scratch),
--   * orphans any uploaded files referenced by that response, returning their
--     storage paths via removed_file_paths so the client can remove them,
--   * preserves the existing atomic waitlist-promotion logic and the
--     promoted_user_id return value the email flow depends on.
-- The published custom form template (registration_forms /
-- registration_form_versions) is intentionally NEVER touched here.
--
-- Depends on:
--   20260809000003_registration_rpcs.sql  (original cancel_registration)
--   20260809000008_registration_form_rpcs.sql  (_extract_file_paths helper)

-- ============================================================================
-- cancel_registration(p_event_id, p_user_id)
--   Returns jsonb:
--     { status: 'cancelled', promoted_user_id: uuid|null,
--       removed_file_paths: text[] }
--     { status: 'left_waitlist', removed_file_paths: text[] }
--   Behaviour:
--   - if the user was registered: DELETEs their registered_events row and their
--     registration_form_responses row, then atomically promotes the oldest
--     waitlisted student to 'registered' (DELETE waiting_list + INSERT
--     registered_events in the same transaction) when capacity allows, returning
--     the promoted user id so the client emails them. Only promotes when there
--     is room (count < capacity or capacity IS NULL) — capacity is never
--     exceeded. Capacity is implicitly updated by removing the row; no manual
--     decrement is needed or performed.
--   - if the user was only waitlisted: DELETEs their waiting_list row and their
--     registration_form_responses row.
--   - otherwise raises 'You are not registered for this event'.
--   NO cancelled-status row is preserved — unregistration is a full reset for
--   that (event, user) pair. The published form template is never modified.
--   removed_file_paths is the list of storage object paths (in the private
--   registration-form-uploads bucket) that the deleted response referenced; the
--   client is expected to best-effort remove them via Storage. It is empty
--   when the event had no custom form or the response had no file fields.
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_registration(p_event_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg_id          uuid;
  v_capacity        int;
  v_registered_cnt  int;
  v_next_user_id    uuid;
  v_next_wait_id    uuid;
  v_promoted        uuid := NULL;
  v_resp_fields     jsonb;
  v_resp_answers    jsonb;
  v_removed_paths   text[] := ARRAY[]::text[];
BEGIN
  -- Snapshot the student's submitted custom-form response (if any) so we can
  -- delete it and orphan its uploaded files once the cancellation is confirmed
  -- valid. The published form template (registration_forms /
  -- registration_form_versions) is intentionally never modified — only the
  -- student's submitted response row is removed.
  SELECT vfv.fields, rfr.answers
    INTO v_resp_fields, v_resp_answers
  FROM registration_form_responses rfr
  JOIN registration_form_versions vfv ON vfv.id = rfr.form_version_id
  WHERE rfr.event_id = p_event_id AND rfr.user_id = p_user_id;

  -- Is the user currently registered?
  SELECT id INTO v_reg_id
  FROM registered_events
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'registered'
  LIMIT 1;

  IF v_reg_id IS NOT NULL THEN
    -- Full reset: remove the submitted custom-form response (and capture the
    -- storage paths it referenced) so a future re-registration shows the form
    -- from scratch. Only runs when a response actually exists for this user.
    IF v_resp_answers IS NOT NULL THEN
      v_removed_paths := _extract_file_paths(v_resp_fields, v_resp_answers);
      DELETE FROM registration_form_responses
      WHERE event_id = p_event_id AND user_id = p_user_id;
    END IF;

    -- Remove their spot entirely. No cancelled-status history row is kept.
    DELETE FROM registered_events WHERE id = v_reg_id;

    -- Lock event to read capacity.
    SELECT capacity INTO v_capacity FROM events WHERE id = p_event_id FOR UPDATE;

    -- Recount registered (the deleted row is now excluded).
    SELECT count(*) INTO v_registered_cnt
    FROM registered_events
    WHERE event_id = p_event_id AND status = 'registered';

    -- If there is room, promote the oldest waitlisted student atomically.
    IF v_capacity IS NULL OR v_registered_cnt < v_capacity THEN
      SELECT wl.user_id, wl.id INTO v_next_user_id, v_next_wait_id
      FROM waiting_list wl
      WHERE wl.event_id = p_event_id
      ORDER BY wl.created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF v_next_user_id IS NOT NULL THEN
        INSERT INTO registered_events (user_id, event_id, status)
        VALUES (v_next_user_id, p_event_id, 'registered');
        DELETE FROM waiting_list WHERE id = v_next_wait_id;
        v_promoted := v_next_user_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'status', 'cancelled',
      'promoted_user_id', v_promoted,
      'removed_file_paths', to_jsonb(v_removed_paths)
    );
  END IF;

  -- Maybe the user was only on the waitlist -> remove them and their response.
  PERFORM 1 FROM waiting_list
  WHERE event_id = p_event_id AND user_id = p_user_id;
  IF FOUND THEN
    IF v_resp_answers IS NOT NULL THEN
      v_removed_paths := _extract_file_paths(v_resp_fields, v_resp_answers);
      DELETE FROM registration_form_responses
      WHERE event_id = p_event_id AND user_id = p_user_id;
    END IF;
    DELETE FROM waiting_list WHERE event_id = p_event_id AND user_id = p_user_id;
    RETURN jsonb_build_object(
      'status', 'left_waitlist',
      'removed_file_paths', to_jsonb(v_removed_paths)
    );
  END IF;

  RAISE EXCEPTION 'You are not registered for this event';
END;
$$;