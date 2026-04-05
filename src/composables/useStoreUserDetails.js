import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

export function useStoreUserDetails() {
  const toast = useToast()
  // const userDetails = ref(null)
  const loading = ref(false)

  // Adds the current user's details to event's registered_students,
  async function addUserToEvent(event) {
    loading.value = true
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('You must be logged in')
      return { success: false }
    }

    const { data: userName, error: eventError } = await supabase
      .from('profile')
      .select('user_name')
      .eq('id', user.id)
      .maybeSingle()
    console.log('Fetched user name:', userName)

    // Check if already registered
    const { data: existing, error: checkError } = await supabase
      .from('registered_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      toast.error(checkError.message)
      return { success: false }
    }

    // const eventIndex = localEvents.value.findIndex((e) => e.id === event.id)
    // if (eventIndex === -1) return

    if (existing) {
      toast.success('You have already registered.')
      return { success: true, status: 'registered' }
    } else {
      if (
        (event.interested_students || 0) >= event.capacity &&
        event.capacity !== 0 &&
        event.capacity !== null
      ) {
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
          return { success: false }
        }

        if (existingWaiting) {
          toast.info('You are already on the waiting list for this event')
          return { success: true, status: 'waitlist' }
        }

        const { error: insertWaitingError } = await supabase
          .from('waiting_list')
          .insert([{ user_id: user.id, event_id: event.id }])

        if (insertWaitingError) {
          toast.error(insertWaitingError.message)
          return { success: false }
        }

        toast.success('Added to waiting list')
        try {
          await fetch('/api/confirm_waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: userName.user_name,
              event: event,
            }),
          })
        } catch (err) {
          console.error('Error sending waitlist email:', err)
        }
        return { success: true, status: 'waitlist' }
      } else {
        // return { success: false }

        const { error: insertError } = await supabase
          .from('registered_events')
          .insert([{ user_id: user.id, event_id: event.id }])

        const { error: updateError } = await supabase
          .from('events')
          .update({ interested_students: event.interested_students + 1 })
          .eq('id', event.id)

        if (updateError) {
          toast.error(updateError.message)
          return { success: false }
        }

        if (insertError) {
          toast.error(insertError.message)
          return { success: false }
        }

        toast.success('Registration successful')
        console.log('user', user, 'userName', userName, 'event', event)
        try {
          await fetch('/api/registration_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: userName.user_name,
              event: event,
            }),
          })
        } catch (error) {
          // toast.error('An error occurred. Please try again.')
          console.log('error sending registration email', error)
        }

        return { success: true, status: 'registered' }
      }
      // localEvents.value[eventIndex].is_interest = true
    }
  }

  async function removeUserFromEvent(event) {
    loading.value = true
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('You must be logged in')
      return { success: false }
    }
    // Check if already registered
    const { data: existing, error: checkError } = await supabase
      .from('registered_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      toast.error(checkError.message)
      return { success: false }
    }

    // const eventIndex = localEvents.value.findIndex((e) => e.id === event.id)
    // if (eventIndex === -1) return

    if (existing) {
      const { error: deleteError } = await supabase
        .from('registered_events')
        .delete()
        .eq('id', existing.id)

      const { error: updateError } = await supabase
        .from('events')
        .update({ interested_students: event.interested_students - 1 })
        .eq('id', event.id)

      if (deleteError) {
        toast.error(deleteError.message)
        return { success: false }
      }

      if (updateError) {
        toast.error(updateError.message)
        return { success: false }
      }

      toast.success('Removed from registered')
      try {
        const response = await fetch('/api/move_waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event }),
        })
        const result = await response.json()
        if (result.success) {
          toast.success('Next student from waitlist registered and emailed')
        } else {
          toast.info(result.message)
        }
      } catch (err) {
        console.error('Error promoting student from waitlist:', err)
        toast.error('Failed to promote next student from waitlist')
      }
    } else {
      toast.info('You are not registered for this event')
      return { success: false }
    }
  }

  return {
    addUserToEvent,
    removeUserFromEvent,
  }
}
