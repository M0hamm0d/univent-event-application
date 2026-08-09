-- UniVent Registration System — Stage 0: atomic registration RPCs
-- Run after 20260809000001_registration_schema.sql and 20260809000002_registration_rls.sql.
-- These are SECURITY DEFINER so they run with the function owner's privileges,
-- bypassing RLS. Capacity math is the single source of truth and is atomic
-- (FOR UPDATE lock on the event row + real count(*) of registered rows).
-- Idempotent (CREATE OR REPLACE).

-- ============================================================================
-- register_for_event(p_event_id, p_user_id)
--   Returns jsonb:
--     { status: 'registered' | 'waitlisted' | 'already_registered' |
--               'already_waitlisted' | 'closed', position?: int }
--   - locks the event row (FOR UPDATE) so concurrent callers serialize
--   - counts only registered_events rows with status='registered' against capacity
--   - capacity IS NULL  -> unlimited (always registers)
--   - capacity = 0      -> closed: returns 'closed', no rows written
--   - capacity > 0      -> register if count < capacity, else waitlist
--   - duplicate guard: checks existing registered + existing waitlist first
-- ============================================================================
CREATE OR REPLACE FUNCTION register_for_event(p_event_id uuid, p_user_id uuid)
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
  v_position       int;
BEGIN
  -- Lock the event row for the duration of the transaction.
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

  -- Already registered?
  SELECT id INTO v_existing_reg
  FROM registered_events
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'registered'
  LIMIT 1;
  IF v_existing_reg IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_registered');
  END IF;

  -- Already waitlisted?
  SELECT id INTO v_existing_wait
  FROM waiting_list
  WHERE event_id = p_event_id AND user_id = p_user_id
  LIMIT 1;
  IF v_existing_wait IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_waitlisted');
  END IF;

  -- Closed event (capacity = 0): no one may register and waitlisting is moot.
  IF v_event.capacity = 0 THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;

  -- Count currently registered attendees.
  SELECT count(*) INTO v_registered_cnt
  FROM registered_events
  WHERE event_id = p_event_id AND status = 'registered';

  -- Unlimited or under capacity -> register.
  IF v_event.capacity IS NULL OR v_registered_cnt < v_event.capacity THEN
    INSERT INTO registered_events (user_id, event_id, status)
    VALUES (p_user_id, p_event_id, 'registered');
    RETURN jsonb_build_object('status', 'registered');
  END IF;

  -- Full -> waitlist.
  INSERT INTO waiting_list (user_id, event_id) VALUES (p_user_id, p_event_id);
  SELECT count(*) INTO v_position FROM waiting_list WHERE event_id = p_event_id;
  RETURN jsonb_build_object('status', 'waitlisted', 'position', v_position);
END;
$$;

-- ============================================================================
-- cancel_registration(p_event_id, p_user_id)
--   Returns jsonb:
--     { status: 'cancelled', promoted_user_id: uuid|null }
--     { status: 'left_waitlist' }
--   - if the user was registered: marks the row status='cancelled' (history kept)
--     then atomically promotes the oldest waitlisted student to 'registered'
--     and deletes that waiting_list row, returning the promoted user id (so the
--     client can email them). Only promotes when there is room (count < capacity
--     or capacity IS NULL) — guaranteeing capacity is never exceeded.
--   - if the user was only waitlisted: removes them from the waiting_list.
--   - otherwise raises 'You are not registered for this event'.
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
BEGIN
  -- Is the user currently registered?
  SELECT id INTO v_reg_id
  FROM registered_events
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'registered'
  LIMIT 1;

  IF v_reg_id IS NOT NULL THEN
    -- Cancel their spot.
    UPDATE registered_events SET status = 'cancelled' WHERE id = v_reg_id;

    -- Lock event to read capacity.
    SELECT capacity INTO v_capacity FROM events WHERE id = p_event_id FOR UPDATE;

    -- Recount registered (the cancelled row is now excluded).
    SELECT count(*) INTO v_registered_cnt
    FROM registered_events
    WHERE event_id = p_event_id AND status = 'registered';

    -- If there is room, promote the oldest waitlisted student.
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

    RETURN jsonb_build_object('status', 'cancelled', 'promoted_user_id', v_promoted);
  END IF;

  -- Maybe the user was only on the waitlist -> just remove them.
  PERFORM 1 FROM waiting_list
  WHERE event_id = p_event_id AND user_id = p_user_id;
  IF FOUND THEN
    DELETE FROM waiting_list WHERE event_id = p_event_id AND user_id = p_user_id;
    RETURN jsonb_build_object('status', 'left_waitlist');
  END IF;

  RAISE EXCEPTION 'You are not registered for this event';
END;
$$;

-- ============================================================================
-- get_event_attendees(p_event_id)
--   Organizer-scoped attendee listing. SECURITY DEFINER + internal ownership
--   check: only the event's owner (events.user_id = auth.uid()) may call it.
--   Returns jsonb:
--     { registered: [ {user_id, user_name, user_email, profile_pics,
--                      status, registered_at} ... ],
--       waitlisted: [ {user_id, user_name, user_email, profile_pics,
--                       created_at} ... ] }
--   Waitlisted attendees are shown separately and do NOT count toward capacity.
--   (form_data answers are NOT returned here yet — added when custom forms ship.)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_event_attendees(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM events WHERE id = p_event_id;

  IF v_owner IS NULL OR v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to view attendees for this event';
  END IF;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'registered', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',       re.user_id,
        'user_name',     p.user_name,
        'user_email',    p.user_email,
        'profile_pics',  p.profile_pics,
        'status',        re.status,
        'registered_at', re.registered_at
      ) ORDER BY re.registered_at ASC)
      FROM registered_events re
      JOIN profile p ON p.id = re.user_id
      WHERE re.event_id = p_event_id AND re.status = 'registered'
    ), '[]'::jsonb),
    'waitlisted', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id',      wl.user_id,
        'user_name',    p.user_name,
        'user_email',   p.user_email,
        'profile_pics', p.profile_pics,
        'created_at',   wl.created_at
      ) ORDER BY wl.created_at ASC)
      FROM waiting_list wl
      JOIN profile p ON p.id = wl.user_id
      WHERE wl.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;