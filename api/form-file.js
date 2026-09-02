/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './_lib/supabase-admin.js'

/**
 * /api/form-file
 *   Serverless signed-URL endpoint for the private `registration-form-uploads`
 *   bucket (Stage 6A migration 007). Files are NEVER public — the anon key
 *   cannot read them. Organizers and students reach private files only through
 *   this endpoint, which verifies identity + authorization before issuing a
 *   short-lived (60s) signed download URL using the service-role key.
 *
 * Authorization rules:
 *   1. Requester must be authenticated (valid JWT in Authorization header).
 *   2. Organizer: may fetch any file whose path belongs to a
 *      registration_form_responses row for an event they own (events.user_id =
 *      requester uid). The event_id in the request body identifies the event;
 *      we additionally verify `path` is referenced by some response for that
 *      event so an organizer can't fabricate a path to read arbitrary files.
 *   3. Student: may fetch only files whose path's first segment equals their
 *      own uid (they own the upload). The event_id check still runs so a
 *      student can't probe another event's namespace.
 *
 * Request:  POST { path: string, eventId: string }
 *           Authorization: Bearer <access_token>
 * Response: 200 { url: string }   (signed URL valid for 60s)
 *           4xx { message: string }
 */
const BUCKET = 'registration-form-uploads'
const SIGNED_URL_TTL = 60 // seconds

const baseUrl = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SERVICE_ROLE_KEY



function unauthorized(res, message = 'Unauthorized') {
  return res.status(401).json({ message })
}
function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ message })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  if (!baseUrl || !serviceRoleKey || !anonKey) {
    console.error('form-file: missing Supabase env vars')
    return res.status(500).json({ message: 'Server misconfigured' })
  }

  const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res)
  }
  const accessToken = authHeader.slice('Bearer '.length).trim()

  const { path, eventId } = req.body || {}
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ message: 'Missing file path' })
  }
  if (!eventId) {
    return res.status(400).json({ message: 'Missing eventId' })
  }

  // Verify the requester's identity by creating a client scoped to their JWT.
  // getUser() validates the token against Supabase Auth.
  const supabaseUser = createClient(baseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser()
  if (userErr || !user) {
    return unauthorized(res, 'Invalid or expired session')
  }
  const requesterUid = user.id

  // Authorization. Either organizer-of-event OR file-owner.
  const pathSegments = path.split('/').filter(Boolean)
  const ownerSegment = pathSegments[0] || ''
  const isOwner = ownerSegment === requesterUid

  let isOrganizer = false
  try {
    const { data: ev, error: evErr } = await getSupabaseAdmin()
      .from('events')
      .select('id, user_id')
      .eq('id', eventId)
      .maybeSingle()
    if (evErr) throw evErr
    if (ev && String(ev.user_id) === String(requesterUid)) {
      isOrganizer = true
    }
  } catch (err) {
    console.error('form-file: organizer lookup failed', err)
    return res.status(500).json({ message: 'Authorization check failed' })
  }

  if (!isOwner && !isOrganizer) {
    return forbidden(res, 'You do not have access to this file')
  }

  // Defense in depth: the path must belong to a registration_form_responses
  // row for this event. This stops an organizer from fabricating a path inside
  // ANOTHER attendee's folder (same event) — which RLS would actually allow
  // since organizers get no storage SELECT — and more importantly guarantees
  // the path is a real submitted answer, not a probe.
  try {
    const { data: resp, error: respErr } = await getSupabaseAdmin()
      .from('registration_form_responses')
      .select('answers')
      .eq('event_id', eventId)
      .limit(1000)
    if (respErr) throw respErr
    const found = (resp || []).some((row) => {
      const answers = row.answers || {}
      return Object.values(answers).some((v) => v === path)
    })
    if (!found) {
      return forbidden(res, 'File is not attached to a submission for this event')
    }
  } catch (err) {
    console.error('form-file: response lookup failed', err)
    return res.status(500).json({ message: 'Could not verify file attachment' })
  }

  // Issue the signed URL with the service-role key (bypasses storage RLS).
  try {
    const { data, error } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL, {
        download: true,
      })
    if (error || !data?.signedUrl) {
      console.error('form-file: createSignedUrl failed', error)
      return res.status(500).json({ message: 'Could not generate download link' })
    }
    return res.status(200).json({ url: data.signedUrl })
  } catch (err) {
    console.error('form-file: signed URL exception', err)
    return res.status(500).json({ message: 'Could not generate download link' })
  }
}