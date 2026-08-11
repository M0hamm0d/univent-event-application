import { supabase } from '@/supabase'

/**
 * isEventRegistered(event, userId)
 *   Returns true only when the user currently HOLDS a spot for the event — i.e.
 *   has a registered_events row with status='registered'. Cancelled students
 *   keep their row (status='cancelled') for history but must NOT show as
 *   registered on the UI; otherwise the card would display "Registered ✓" for
 *   someone who already cancelled, and clicking the button would call
 *   cancel_registration which raises 'You are not registered for this event'.
 *
 * The unique index on (event_id, user_id) means a user has at most one row per
 * event, so we filter on status and use maybeSingle() (a cancelled row, or no
 * row at all, both yield data=null -> false).
 */
export async function isEventRegistered(event, userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('registered_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', event?.id)
    .eq('status', 'registered')
    .maybeSingle()
  if (error) {
    console.error('isEventRegistered error:', error.message)
    return false
  }
  return !!data
}
