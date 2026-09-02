import { supabase } from '@/supabase'

export async function isEventRegistered(event, userId) {
  if (!userId) return false
  const eventId = event?.id
  if (!eventId) return false

  // Primary: legacy registered_events table.
  const { data, error } = await supabase
    .from('registered_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('status', 'registered')
    .maybeSingle()
  if (error) {
    console.error('isEventRegistered error:', error.message)
  }
  if (data) return true

  // Fallback: custom-form events store registration via
  // registration_form_responses + a registered_events row created by the RPC.
  // If the legacy row is absent, check whether a form response exists AND a
  // registered_events row exists for this user/event (any status) — the RPC
  // creates both atomically, so a response with a registered row means the
  // user is registered.
  const { data: resp } = await supabase
    .from('registration_form_responses')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!resp) return false

  const { data: reg } = await supabase
    .from('registered_events')
    .select('status')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()
  return reg?.status === 'registered'
}
