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

      const {error: updateError} = await supabase
        .from('events')
        .update({ interested_students: event.interested_students - 1 })
        .eq('id', event.id)

      if (deleteError) {
        toast.error(deleteError.message)
        return
      }

      if (updateError) {
        toast.error(updateError.message)
        return
      }

      toast.success('Removed from interested')
      localEvents.value[eventIndex].is_interest = false
    } else {
      console.log('Adding to interested')
      if ( event.interested_students >= event.capacity && event.capacity !== 0 && event.capacity !== null) {
        toast.error('Event is full, you will be added to the waiting list')
        // Add to waiting list
        // first check if already on waiting list
        const { data: existingWaiting, error: waitingError } = await supabase
          .from('waiting_list')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_id', event.id)
          .maybeSingle()

        if (waitingError && waitingError.code !== 'PGRST116') {
          toast.error(waitingError.message)
          return
        }

        if (existingWaiting) {
          toast.info('You are already on the waiting list for this event')
          return
        }

        const { error: insertWaitingError } = await supabase
          .from('waiting_list')
          .insert([{ user_id: user.id, event_id: event.id }])

        if (insertWaitingError) {
          toast.error(insertWaitingError.message)
          return { success: false }
        }

        toast.success('Added to waiting list')
        return { success: true }
      } else {
      const { error: insertError } = await supabase
        .from('interested_events')
        .insert([{ user_id: user.id, event_id: event.id }])

      const { error: updateError } = await supabase
        .from('events')
        .update({ interested_students: event.interested_students + 1 })
        .eq('id', event.id)

      if (insertError) {
        toast.error(insertError.message)
        return
      }

      if (updateError) {
        toast.error(updateError.message)
        return
        }

      toast.success('Marked as interested')
      localEvents.value[eventIndex].is_interest = true
    }
    }
  }

  return { toggleInterest }
}
