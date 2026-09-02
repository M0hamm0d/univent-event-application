import { supabase } from '@/supabase'

export async function isInWaitingList(event, userId) {
  if (!userId) return false
  const eventId = event?.id
  if (!eventId) return false

  // Primary: waiting_list table.
  const { data, error } = await supabase
    .from('waiting_list')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) {
    console.error('isInWaitingList error:', error.message)
  }
  if (data) return true

  // Fallback: custom-form events may record waitlist status via
  // registration_form_responses with no registered_events row. If a form
  // response exists but no registered_events row does, the user is waitlisted.
  const { data: resp } = await supabase
    .from('registration_form_responses')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!resp) return false

  const { data: reg } = await supabase
    .from('registered_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle()
  // A form response with no registered row means the user is waitlisted.
  return !reg
}
