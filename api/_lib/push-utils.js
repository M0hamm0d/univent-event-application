/* eslint-disable no-undef */
/**
 * Shared Web Push utility for UniVent serverless endpoints.
 *
 * IMPORTANT: This module uses lazy initialization for the Supabase client
 * and VAPID configuration. Nothing runs at import time, so importing this
 * module will NEVER crash — even if push env vars are missing.
 *
 * Usage:
 *   import { sendPushToUser, sendPushToUsers } from './push-utils.js'
 *
 *   // Single user
 *   await sendPushToUser(userId, { title: '...', body: '...', url: '/discover?...' })
 *
 *   // Multiple users
 *   await sendPushToUsers([userId1, userId2], { title: '...', body: '...' })
 *
 * Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 * Also requires: SUPABASE_URL, SERVICE_ROLE_KEY (for DB access)
 */
import { createClient } from '@supabase/supabase-js'
import webPush from 'web-push'

/* ------------------------------------------------------------------ */
/*  Lazy initialization — runs once on first use, never at import time */
/* ------------------------------------------------------------------ */

let _supabaseAdmin = null
let _vapidConfigured = false

/**
 * Return a singleton Supabase admin client.
 * Creates it on first call; returns the cached instance afterward.
 * Never throws at import time.
 */
function getSupabase() {
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('push-utils: SUPABASE_URL or SERVICE_ROLE_KEY is not set — push disabled')
      return null
    }
    _supabaseAdmin = createClient(url, key)
  }
  return _supabaseAdmin
}

/**
 * Ensure VAPID details are configured on webPush.
 * Runs once; no-ops on subsequent calls.
 */
function ensureVapid() {
  if (_vapidConfigured) return
  _vapidConfigured = true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@univent.website'
  if (pub && priv) {
    webPush.setVapidDetails(email, pub, priv)
  }
}

/* ------------------------------------------------------------------ */
/*  Dedup helpers (push_notification_log)                              */
/* ------------------------------------------------------------------ */

/**
 * Check whether a push notification has already been sent for this
 * (type, user, event, window) combination. Returns true if already sent.
 */
export async function isPushAlreadySent(notificationType, userId, eventId, reminderWindow = null) {
  const db = getSupabase()
  if (!db) return false

  const { data, error } = await db
    .from('push_notification_log')
    .select('id')
    .eq('notification_type', notificationType)
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('reminder_window', reminderWindow)
    .maybeSingle()

  if (error) {
    console.error('push-utils: dedup check error:', error.message)
    return false // On error, allow the push (fail-open for delivery)
  }
  return !!data
}

/**
 * Record that a push notification was sent (for dedup).
 */
export async function recordPushSent(notificationType, userId, eventId, reminderWindow = null) {
  const db = getSupabase()
  if (!db) return

  const { error } = await db
    .from('push_notification_log')
    .insert({
      notification_type: notificationType,
      user_id: userId,
      event_id: eventId,
      reminder_window: reminderWindow,
    })

  if (error) {
    // Unique constraint violation means it was already recorded — that's fine.
    if (error.code === '23505') return
    console.error('push-utils: record push error:', error.message)
  }
}

/* ------------------------------------------------------------------ */
/*  Subscription cleanup                                               */
/* ------------------------------------------------------------------ */

/**
 * Delete a stale subscription (404 or 410 from push service).
 */
async function deleteStaleSubscription(endpoint) {
  const db = getSupabase()
  if (!db) return

  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) {
    console.error('push-utils: failed to delete stale subscription:', error.message)
  }
}

/* ------------------------------------------------------------------ */
/*  Push sending                                                       */
/* ------------------------------------------------------------------ */

/**
 * Send a push notification to all subscriptions of a single user.
 * Silently skips if VAPID keys are not configured.
 * Returns { sent, failed } counts.
 */
export async function sendPushToUser(userId, payload) {
  ensureVapid()

  const vapidPub = process.env.VAPID_PUBLIC_KEY
  const vapidPriv = process.env.VAPID_PRIVATE_KEY

  if (!vapidPub || !vapidPriv) {
    console.log('push-utils: VAPID keys not configured — push skipped')
    return { sent: 0, failed: 0, skipped: true, reason: 'VAPID keys not configured' }
  }

  const db = getSupabase()
  if (!db) {
    return { sent: 0, failed: 0, skipped: true, reason: 'Supabase admin client unavailable' }
  }

  const { data: subscriptions, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', userId)

  if (error) {
    console.error('push-utils: fetch subscriptions error:', error.message)
    return { sent: 0, failed: 0 }
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, reason: 'no subscriptions' }
  }

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth_key,
          },
        },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      failed++
      // 404 = subscription expired/removed; 410 = subscription revoked
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`push-utils: removing stale subscription (status ${err.statusCode})`)
        await deleteStaleSubscription(sub.endpoint)
      } else {
        console.error(`push-utils: push failed for endpoint:`, err.message)
      }
    }
  }

  return { sent, failed }
}

/**
 * Send a push notification to multiple users.
 * Returns { totalSent, totalFailed }.
 */
export async function sendPushToUsers(userIds, payload) {
  let totalSent = 0
  let totalFailed = 0

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload)
    totalSent += result.sent || 0
    totalFailed += result.failed || 0
  }

  return { totalSent, totalFailed }
}
