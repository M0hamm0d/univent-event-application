// composables/useInterestedEvents.js
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

export function useInterestedEvents() {
  const toast = useToast()

  async function toggleInterest(event, localEvents) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('You must be logged in')
      return
    }

    const { data: existing, error: checkError } = await supabase
      .from('interested_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      toast.error(checkError.message)
      return
    }

    const eventIndex = localEvents.value.findIndex((e) => e.id === event.id)
    if (eventIndex === -1) return

    if (existing) {
      const { error: deleteError } = await supabase
        .from('interested_events')
        .delete()
        .eq('id', existing.id)

      if (deleteError) {
        toast.error(deleteError.message)
        return
      }

      toast.success('Removed from interested')
      localEvents.value[eventIndex].is_interest = false
    } else {
      const { error: insertError } = await supabase
        .from('interested_events')
        .insert([{ user_id: user.id, event_id: event.id }])

      if (insertError) {
        toast.error(insertError.message)
        return
      }

      toast.success('Marked as interested')
      localEvents.value[eventIndex].is_interest = true
    }
  }

  return { toggleInterest }
}
