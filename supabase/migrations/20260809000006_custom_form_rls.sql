-- UniVent Registration System — Stage 6A: custom form RLS
-- Run after 20260809000005_custom_form_schema.sql.
-- Idempotent (DROP POLICY IF EXISTS + CREATE POLICY).
--
-- Security model:
--   * Organizers may fully manage their own events' forms/versions.
--   * Students may read/insert their OWN responses only. Editing mutations
--     never go through PostgREST; only the update_form_response RPC (which
--     re-checks that registration is open) can mutate a response, so no
--     UPDATE/DELETE policies exist here — clients cannot bypass the open-check.
--   * registration_form_versions is intentionally IMMUTABLE via RLS: no UPDATE
--     and no DELETE policy means organizers cannot rewrite a published snapshot
--     and corrupt old submissions.
--   * Students never read form definitions/versions through PostgREST. They
--     receive the active published version through the get_active_registration_form
--     RPC (SECURITY DEFINER), which returns only the published fields — never
--     drafts or other versions. This keeps drafts private to the organizer.
--   * Organizer-of-event checks use the same EXISTS pattern as the Stage 0 RLS
--     migration, comparing events.user_id = auth.uid()::text.

-- ============================================================================
-- registration_forms RLS
-- ============================================================================
ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registration_forms_organizer_select" ON registration_forms;
CREATE POLICY "registration_forms_organizer_select" ON registration_forms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "registration_forms_organizer_insert" ON registration_forms;
CREATE POLICY "registration_forms_organizer_insert" ON registration_forms
  FOR INSERT WITH CHECK (
    organizer_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "registration_forms_organizer_update" ON registration_forms;
CREATE POLICY "registration_forms_organizer_update" ON registration_forms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    -- event_id cannot be moved to another organizer's event on update.
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "registration_forms_organizer_delete" ON registration_forms;
CREATE POLICY "registration_forms_organizer_delete" ON registration_forms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_forms.event_id
        AND e.user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- registration_form_versions RLS  (immutable: SELECT + INSERT only)
-- ============================================================================
ALTER TABLE registration_form_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registration_form_versions_organizer_select" ON registration_form_versions;
CREATE POLICY "registration_form_versions_organizer_select" ON registration_form_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registration_forms f
      WHERE f.id = registration_form_versions.form_id
        AND f.organizer_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "registration_form_versions_organizer_insert" ON registration_form_versions;
CREATE POLICY "registration_form_versions_organizer_insert" ON registration_form_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM registration_forms f
      WHERE f.id = registration_form_versions.form_id
        AND f.organizer_id = auth.uid()::text
    )
  );

-- No UPDATE, no DELETE policy => immutable via PostgREST. (The publish RPC and
-- any cleanup RPCs are SECURITY DEFINER and bypass RLS, but those are the only
-- sanctioned mutation paths.)

-- ============================================================================
-- registration_form_responses RLS
--   SELECT: self OR organizer-of-event (organizer reads via Manage Attendees).
--   INSERT: self only (defense in depth; the register_with_form RPC bypasses
--           RLS but a direct insert by the same user is also fine).
--   No UPDATE, no DELETE: only the SECURITY DEFINER update_form_response RPC
--           can mutate. This guarantees the "must be open to edit" and
--           "preserve for audit" rules cannot be bypassed by the client.
-- ============================================================================
ALTER TABLE registration_form_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registration_form_responses_self_or_organizer_select" ON registration_form_responses;
CREATE POLICY "registration_form_responses_self_or_organizer_select" ON registration_form_responses
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registration_form_responses.event_id
        AND e.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "registration_form_responses_self_insert" ON registration_form_responses;
CREATE POLICY "registration_form_responses_self_insert" ON registration_form_responses
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );