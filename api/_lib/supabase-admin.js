/* eslint-disable no-undef */
/**
 * Lazy-initialized Supabase admin (service-role) client.
 *
 * Importing this module NEVER crashes — even if SUPABASE_URL or
 * SERVICE_ROLE_KEY is undefined.  The client is created on first use.
 *
 * Usage:
 *   import { getSupabaseAdmin } from './_lib/supabase-admin.js'
 *   const db = getSupabaseAdmin()
 *   if (!db) { /* env vars missing — skip DB ops *\/ }
 */
import { createClient } from '@supabase/supabase-js'

let _client = null
let _warned = false

/**
 * Return a singleton Supabase admin client.
 * Creates it on first call; returns the cached instance afterward.
 * Returns null (with a console warning) if env vars are missing.
 */
export function getSupabaseAdmin() {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SERVICE_ROLE_KEY

  if (!url || !key) {
    if (!_warned) {
      _warned = true
      console.error('supabase-admin: SUPABASE_URL or SERVICE_ROLE_KEY is not set — DB operations will be skipped')
    }
    return null
  }

  _client = createClient(url, key)
  return _client
}
