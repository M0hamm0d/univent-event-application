/* eslint-disable no-undef */
/**
 * Shared Web Push utility for UniVent serverless endpoints.
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

const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey)

// Configure VAPID only if keys are present (allows local dev without push).
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@univent.website'

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

/**
 * Check whether a push notification has already been sent for this
 * (type, user, event, window) combination. Returns true if already sent.
 */
export async function isPushAlreadySent(notificationType, userId, eventId, reminderWindow = null) {
  const { data, error } = await supabaseAdmin
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
  const { error } = await supabaseAdmin
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

/**
 * Delete a stale subscription (404 or 410 from push service).
 */
async function deleteStaleSubscription(endpoint) {
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) {
    console.error('push-utils: failed to delete stale subscription:', error.message)
  }
}

/**
 * Send a push notification to all subscriptions of a single user.
 * Silently skips if VAPID keys are not configured.
 * Returns { sent, failed } counts.
 */
export async function sendPushToUser(userId, payload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { sent: 0, failed: 0, skipped: true, reason: 'VAPID keys not configured' }
  }

  const { data: subscriptions, error } = await supabaseAdmin
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
