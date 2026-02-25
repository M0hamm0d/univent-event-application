import { supabase } from '@/supabase'

export async function isEventRegistered(event, userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('registered_events')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', event?.id)
    .maybeSingle()
  // console.log('isEventRegistered check:', { eventId: event.id, userId, data, error })
  // if (error) return false
  if (data) return true
  return false
}
