-- UniVent Registration System — Stage 0: schema changes
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- Idempotent: safe to re-run.

-- ============================================================================
-- events.capacity: standardize "unlimited" on NULL.
--   capacity IS NULL  -> unlimited
--   capacity = 0      -> registration closed (no one may register)
--   capacity > 0      -> finite capacity
-- Backfill existing rows that used 0 to mean "unlimited" to NULL.
-- ============================================================================
UPDATE events SET capacity = NULL WHERE capacity = 0;

-- ============================================================================
-- registered_events: add status / registered_at / form_data + unique pair.
--   status:
--     'registered'  -> student currently holds a spot
--     'cancelled'    -> student cancelled (kept for history/analytics)
--   registered_at: when they got the spot (created_at already exists, but
--     registered_at is the authoritative "got the spot" timestamp and will
--     be re-set when promoted from the waitlist).
--   form_data jsonb: future custom-registration-form answers live here,
--     kept separate from the permanent `profile` table. Empty for now.
-- ============================================================================
ALTER TABLE registered_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'cancelled')),
  ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill any pre-existing rows to 'registered'.
UPDATE registered_events SET status = 'registered' WHERE status IS NULL;

-- Prevent a user from holding more than one row per event (the race guard).
CREATE UNIQUE INDEX IF NOT EXISTS registered_events_event_user_idx
  ON registered_events (event_id, user_id);

-- ============================================================================
-- waiting_list: unique pair (a user can only be on the waitlist once per event).
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS waiting_list_event_user_idx
  ON waiting_list (event_id, user_id);

-- ============================================================================
-- Helpers: count views for registered / waitlist counts, used by RPCs & client.
-- (Views make it easy to read public counts without exposing user rows.)
-- ============================================================================
CREATE OR REPLACE VIEW registered_count_view AS
SELECT event_id, count(*) AS registered_count
FROM registered_events
WHERE status = 'registered'
GROUP BY event_id;

CREATE OR REPLACE VIEW waitlist_count_view AS
SELECT event_id, count(*) AS waitlist_count
FROM waiting_list
GROUP BY event_id;