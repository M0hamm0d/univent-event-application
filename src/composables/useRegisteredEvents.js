import { supabase } from '@/supabase'

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
