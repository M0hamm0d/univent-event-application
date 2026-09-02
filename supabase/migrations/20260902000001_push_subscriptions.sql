-- UniVent Web Push Notifications — Stage 1: subscription + delivery log schema
-- Idempotent: safe to re-run.

-- ============================================================================
-- push_subscriptions: one row per (user, device/browser).
--   The same user may have multiple subscriptions (laptop + phone + tablet).
--   The endpoint is the unique per-device identifier from the Push API.
--   UNIQUE(user_id, endpoint) prevents duplicate rows for the same device.
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL,
  p256dh       text NOT NULL,
  auth_key     text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/delete their own subscriptions only.
DROP POLICY IF EXISTS "push_subscriptions_self_select" ON push_subscriptions;
CREATE POLICY "push_subscriptions_self_select" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_self_insert" ON push_subscriptions;
CREATE POLICY "push_subscriptions_self_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_self_delete" ON push_subscriptions;
CREATE POLICY "push_subscriptions_self_delete" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);

-- updated_at maintenance trigger (idempotent).
CREATE OR REPLACE FUNCTION push_subscriptions_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_touch_updated_at ON push_subscriptions;
CREATE TRIGGER push_subscriptions_touch_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION push_subscriptions_touch_updated_at();

-- ============================================================================
-- push_notification_log: tracks which push notifications have been sent.
--   Prevents duplicate push delivery for the same logical event.
--   Dedup key: (notification_type, user_id, event_id, reminder_window).
--
--   notification_type:
--     'reminder_1day'    — 1 day before event
--     'reminder_1hr'     — 1 hour before event
--     'registration'     — registration confirmed
--     'waitlist_promo'   — promoted from waitlist
--     'date_announced'   — event date announced
--     'date_undecided'   — event date became undecided
--
--   reminder_window: groups deliveries by time window (e.g. the date string
--   "2026-09-03" for a 1day reminder). Ensures the cron can re-run safely
--   without double-sending within the same window.
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_notification_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type  text NOT NULL,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id           uuid REFERENCES events(id) ON DELETE CASCADE,
  reminder_window    text,         -- e.g. date string or NULL for non-reminder types
  sent_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_type, user_id, event_id, reminder_window)
);

-- No RLS needed — this table is only written/read by service-role (serverless).
-- But enable RLS anyway for defense-in-depth; service-role bypasses it.
ALTER TABLE push_notification_log ENABLE ROW LEVEL SECURITY;

-- Service-role only (no policies = no access for anon/authenticated).
-- The serverless functions use SERVICE_ROLE_KEY which bypasses RLS.

CREATE INDEX IF NOT EXISTS push_notification_log_dedup_idx
  ON push_notification_log (notification_type, user_id, event_id, reminder_window);

-- Cleanup: remove log entries older than 30 days (optional, can be cron'd later).
-- Kept as a comment for now — uncomment if you add a cleanup cron.
-- DELETE FROM push_notification_log WHERE sent_at < now() - interval '30 days';
