/* eslint-disable no-undef */
/**
 * Shared authorization guard for UniVent serverless email endpoints.
 *
 * Two modes:
 *   1. Secret mode  — the caller sends `x-api-secret` matching env var
 *      API_EMAIL_SECRET. Used for cron/external-triggered endpoints
 *      (new_event_email, newFaculty_event_email, reminder).
 *   2. JWT mode     — the caller sends `Authorization: Bearer <access_token>`
 *      which is verified against Supabase Auth. Used for user-triggered
 *      endpoints (registration_email, confirm_waitlist, send-*, notify-date-*
 *      , move_waitlist) so only authenticated users can trigger emails.
 *
 * Usage at the top of a handler:
 *   const auth = await requireAuth(req, res)   // { ok, uid? }
 *   if (!auth.ok) return        // response already sent
 *
 * For secret-only endpoints (no JWT):
 *   const auth = await requireAuth(req, res, { allowSecretOnly: true })
 */
import { createClient } from '@supabase/supabase-js'

const baseUrl = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const apiSecret = process.env.API_EMAIL_SECRET

export async function requireAuth(req, res, options = {}) {
  const allowSecretOnly = options.allowSecretOnly === true

  // --- Secret mode ----------------------------------------------------------
  if (apiSecret && req.headers) {
    const sent =
      req.headers['x-api-secret'] || req.headers['X-Api-Secret'] || req.headers['x-api-key']
    if (sent && sent === apiSecret) {
      return { ok: true, uid: null, via: 'secret' }
    }
  }

  if (allowSecretOnly) {
    return { ok: false }
  }

  // --- JWT mode -------------------------------------------------------------
  const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' })
    return { ok: false }
  }
  const accessToken = authHeader.slice('Bearer '.length).trim()

  if (!baseUrl || !anonKey) {
    console.error('auth: missing Supabase env vars')
    res.status(500).json({ message: 'Server misconfigured' })
    return { ok: false }
  }

  const supabaseUser = createClient(baseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser()

  if (userErr || !user) {
    res.status(401).json({ message: 'Invalid or expired session' })
    return { ok: false }
  }

  return { ok: true, uid: user.id, via: 'jwt' }
}
