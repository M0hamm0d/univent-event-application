import { supabase } from '@/supabase'

export async function isInWaitingList(event, userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('waiting_list')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', event?.id)
    .maybeSingle()
  // console.log('isInWaitingList check:', { eventId: event.id, userId, data, error })
  if (error) return false
  if (data) return true
  return false
}
