-- UniVent Registration System — Stage 0: RLS policies
-- Run after 20260809000001_registration_schema.sql.

-- ============================================================================
-- registered_events RLS
-- ============================================================================

ALTER TABLE registered_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registered_events_self_select" ON registered_events;

CREATE POLICY "registered_events_self_select" ON registered_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registered_events.event_id
        AND e.user_id = auth.uid()::text
    )
  );


DROP POLICY IF EXISTS "registered_events_self_insert" ON registered_events;

CREATE POLICY "registered_events_self_insert" ON registered_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );


DROP POLICY IF EXISTS "registered_events_self_update" ON registered_events;

CREATE POLICY "registered_events_self_update" ON registered_events
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registered_events.event_id
        AND e.user_id = auth.uid()::text
    )
  );


DROP POLICY IF EXISTS "registered_events_self_delete" ON registered_events;

CREATE POLICY "registered_events_self_delete" ON registered_events
  FOR DELETE USING (
    user_id = auth.uid()
  );


-- ============================================================================
-- waiting_list RLS
-- ============================================================================

ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waiting_list_self_select" ON waiting_list;

CREATE POLICY "waiting_list_self_select" ON waiting_list
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = waiting_list.event_id
        AND e.user_id = auth.uid()::text
    )
  );


DROP POLICY IF EXISTS "waiting_list_self_insert" ON waiting_list;

CREATE POLICY "waiting_list_self_insert" ON waiting_list
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );


DROP POLICY IF EXISTS "waiting_list_self_delete" ON waiting_list;

CREATE POLICY "waiting_list_self_delete" ON waiting_list
  FOR DELETE USING (
    user_id = auth.uid()
  );


-- -- UniVent Registration System — Stage 0: RLS policies
-- -- Run after 20260809000001_registration_schema.sql.
-- -- Idempotent.

-- -- ============================================================================
-- -- registered_events RLS
-- --   SELECT: a user may read their own registrations OR any registration for an
-- --           event they organize (events.user_id = auth.uid()).
-- --   INSERT: only for your own user_id (the RPC bypasses RLS via SECURITY DEFINER).
-- --   UPDATE: yourself or the event organizer.
-- --   DELETE: only your own row (cancellation now uses status='cancelled' via the
-- --           RPC, but keep DELETE permissive for the legacy client path until
-- --           Stage 2 lands).
-- -- ============================================================================
-- ALTER TABLE registered_events ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "registered_events_self_select" ON registered_events;
-- CREATE POLICY "registered_events_self_select" ON registered_events
--   FOR SELECT USING (
--     user_id = auth.uid()::text
--     OR EXISTS (
--       SELECT 1 FROM events e
--       WHERE e.id = registered_events.event_id
--         AND e.user_id = auth.uid()
--     )
--   );

-- DROP POLICY IF EXISTS "registered_events_self_insert" ON registered_events;
-- CREATE POLICY "registered_events_self_insert" ON registered_events
--   FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- DROP POLICY IF EXISTS "registered_events_self_update" ON registered_events;
-- CREATE POLICY "registered_events_self_update" ON registered_events
--   FOR UPDATE USING (
--     user_id = auth.uid()::text
--     OR EXISTS (
--       SELECT 1 FROM events e
--       WHERE e.id = registered_events.event_id
--         AND e.user_id = auth.uid()
--     )
--   );

-- DROP POLICY IF EXISTS "registered_events_self_delete" ON registered_events;
-- CREATE POLICY "registered_events_self_delete" ON registered_events
--   FOR DELETE USING (user_id = auth.uid()::text);

-- -- ============================================================================
-- -- waiting_list RLS (same shape as registered_events).
-- -- ============================================================================
-- ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "waiting_list_self_select" ON waiting_list;
-- CREATE POLICY "waiting_list_self_select" ON waiting_list
--   FOR SELECT USING (
--     user_id = auth.uid()::text
--     OR EXISTS (
--       SELECT 1 FROM events e
--       WHERE e.id = waiting_list.event_id
--         AND e.user_id = auth.uid()
--     )
--   );

-- DROP POLICY IF EXISTS "waiting_list_self_insert" ON waiting_list;
-- CREATE POLICY "waiting_list_self_insert" ON waiting_list
--   FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- DROP POLICY IF EXISTS "waiting_list_self_delete" ON waiting_list;
-- CREATE POLICY "waiting_list_self_delete" ON waiting_list
--   FOR DELETE USING (user_id = auth.uid()::text);

-- -- NOTE: these do not change any existing events RLS — organizer ownership for
-- -- attendee reads is additionally enforced inside get_event_attendees() (Stage 0
-- -- RPC migration), so even if the anon key is abused, cross-organizer attendee
-- -- reads are blocked.