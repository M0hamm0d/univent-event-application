/* eslint-disable no-undef */
/**
 * Push Subscription CRUD endpoint.
 *
 * POST   /api/push-subscribe  — upsert a subscription (user's current browser)
 * DELETE /api/push-subscribe  — remove the caller's subscription for this endpoint
 * GET    /api/push-subscribe  — check if the caller has any active subscriptions
 *
 * All methods require JWT auth (the user must be logged in).
 */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { requireAuth } from './auth.js'

const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey)

export default async function handler(req, res) {
  // All methods require JWT auth.
  const auth = await requireAuth(req, res)
  if (!auth.ok) return

  const userId = auth.uid

  try {
    switch (req.method) {
      case 'GET':
        return handleGet(userId, res)
      case 'POST':
        return handlePost(userId, req, res)
      case 'DELETE':
        return handleDelete(userId, req, res)
      default:
        return res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (err) {
    console.error('push-subscribe error:', err)
    return res.status(500).json({ message: err.message || 'Internal error' })
  }
}

/**
 * GET — return count of active subscriptions for the caller.
 */
async function handleGet(userId, res) {
  const { data, error, count } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_agent, created_at', { count: 'exact' })
    .eq('user_id', userId)

  if (error) throw error

  return res.status(200).json({
    subscribed: count > 0,
    count: count || 0,
    subscriptions: data || [],
  })
}

/**
 * POST — upsert a subscription. Body: { endpoint, p256dh, auth, userAgent? }
 */
async function handlePost(userId, req, res) {
  const { endpoint, p256dh, auth: authKey, userAgent } = req.body

  if (!endpoint || !p256dh || !authKey) {
    return res.status(400).json({ message: 'endpoint, p256dh, and auth are required' })
  }

  // Upsert: if this endpoint already exists for this user, update it.
  // If it's a new endpoint, insert it.
  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth_key: authKey,
        user_agent: userAgent || null,
      },
      { onConflict: 'user_id,endpoint' },
    )
    .select('id')
    .maybeSingle()

  if (error) throw error

  return res.status(200).json({ success: true, id: data?.id })
}

/**
 * DELETE — remove a subscription. Body: { endpoint }
 */
async function handleDelete(userId, req, res) {
  const { endpoint } = req.body

  if (!endpoint) {
    return res.status(400).json({ message: 'endpoint is required' })
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) throw error

  return res.status(200).json({ success: true })
}
