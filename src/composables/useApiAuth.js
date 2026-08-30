import { supabase } from '@/supabase'

/**
 * Build fetch options with the Supabase access token in the Authorization
 * header, so the serverless email endpoints (which now require auth) accept
 * the call. Returns a merged options object; does NOT throw if there is no
 * session (the endpoint will 401 and the caller's catch handles it).
 *
 * Usage:
 *   const opts = await withAuthHeader({ method: 'POST', headers: {...}, body: ... })
 *   await fetch('/api/registration_email', opts)
 */
export async function withAuthHeader(options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers = { ...(options.headers || {}) }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return { ...options, headers }
}
