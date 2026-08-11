-- UniVent Registration System — Stage 6A: custom registration form schema
-- Run after 20260809000004_registered_reminder_flags.sql.
-- Idempotent: safe to re-run.
--
-- Adds the three tables that back optional custom registration forms:
--   registration_forms           - one per event (1:1), the editable draft
--   registration_form_versions   - immutable snapshots published for students
--   registration_form_responses  - one submitted answer set per student per event
--
-- Design notes:
--   * Field DEFINITIONS live as JSONB so new field types can ship without DDL.
--   * Each PUBLISH writes an immutable row to registration_form_versions, and
--     responses store the form_version_id they were submitted against. This is
--     the version/snapshot strategy — if an organizer later edits the form,
--     old submissions keep pointing at the version the student saw, so their
--     answers never silently change meaning.
--   * responses are keyed on (event_id, user_id), NOT on registered_events or
--     waiting_list rows. That pair is the stable identity across the whole
--     registration lifecycle:
--        waitlisted  -> promoted -> registered   (waiting_list row deleted,
--                                                 registered_events row created,
--                                                 response row never moves)
--        registered  -> cancelled                (status flipped, response kept)
--     So responses survive promotion/cancellation with zero plumbing in the
--     promotion/cancellation RPCs.
--   * The existing registered_events.form_data column (Stage 0, unused) is left
--     in place here; a later cleanup migration will drop it once the new flow
--     is validated. Do NOT reuse it for this feature.
--
-- NOTE on table ordering: registration_form_versions is created FIRST because
-- registration_forms.current_version_id references it (Postgres forbids forward
-- FK references inside CREATE TABLE).

-- ============================================================================
-- registration_form_versions: immutable publish snapshots.
--   One row per (form_id, version). The `fields` jsonb is the exact field defs
--   the organizer published and is the contract students submit against.
--   No UPDATE/DELETE RLS policy is defined (see 20260809000006) so published
--   snapshots cannot be rewritten -> old submissions cannot be corrupted.
--   (form_id FK is added AFTER registration_forms exists — forward reference.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS registration_form_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      uuid NOT NULL,
  version      int  NOT NULL,
  fields       jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, version)
);

-- ============================================================================
-- registration_forms: the editable form definition, 1:1 with an event.
--   status:
--     'draft'     -> organizer is building it; students cannot see/submit it
--     'published' -> at least one version snapshot exists and is active
--     'closed'    -> organizer explicitly closed registration
--     'archived'  -> soft-removed (event ended)
--   fields_draft jsonb: the array of field defs the organizer is editing. NOT
--     shown to students. Students only ever see the immutable published version.
--   current_version_id: the active registration_form_versions id (NULL while
--     still draft / never published).
-- ============================================================================
CREATE TABLE IF NOT EXISTS registration_forms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  organizer_id        text NOT NULL,  -- denormalized events.user_id for convenience
  title               text NOT NULL DEFAULT 'Registration Form',
  description         text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','closed','archived')),
  current_version_id  uuid REFERENCES registration_form_versions(id) ON DELETE SET NULL,
  fields_draft        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_forms_organizer_idx
  ON registration_forms (organizer_id);

-- Now add the versions -> forms FK (couldn't be inline because forms is the
-- parent and versions was created first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'registration_form_versions_form_id_fkey'
      AND table_name = 'registration_form_versions'
  ) THEN
    ALTER TABLE registration_form_versions
      ADD CONSTRAINT registration_form_versions_form_id_fkey
      FOREIGN KEY (form_id) REFERENCES registration_forms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- updated_at maintenance helper (idempotent).
CREATE OR REPLACE FUNCTION registration_forms_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_forms_touch_updated_at ON registration_forms;
CREATE TRIGGER registration_forms_touch_updated_at
  BEFORE UPDATE ON registration_forms
  FOR EACH ROW EXECUTE FUNCTION registration_forms_touch_updated_at();

-- ============================================================================
-- registration_form_responses: one submitted answer set per student per event.
--   * UNIQUE (event_id, user_id) -> a student has at most one active response
--     for an event. This holds across the full lifecycle (registered, waitlisted,
--     promoted, cancelled) because the key does not depend on the registration
--     tables.
--   * answers jsonb: { "field_key": value, ... }. Stored exactly as submitted.
--   * form_version_id ON DELETE RESTRICT -> a snapshot with responses can never
--     be removed out from under existing answers.
--   * Students keep an immutable submitted_at; updated_at is bumped only when the
--     student edits their own answers (v1 records the latest version only).
-- ============================================================================
CREATE TABLE IF NOT EXISTS registration_form_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,  -- = auth.uid()
  form_id         uuid NOT NULL REFERENCES registration_forms(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES registration_form_versions(id) ON DELETE RESTRICT,
  answers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS registration_form_responses_event_idx
  ON registration_form_responses (event_id);
CREATE INDEX IF NOT EXISTS registration_form_responses_user_idx
  ON registration_form_responses (user_id);

CREATE OR REPLACE FUNCTION registration_form_responses_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_form_responses_touch_updated_at
  ON registration_form_responses;
CREATE TRIGGER registration_form_responses_touch_updated_at
  BEFORE UPDATE ON registration_form_responses
  FOR EACH ROW EXECUTE FUNCTION registration_form_responses_touch_updated_at();