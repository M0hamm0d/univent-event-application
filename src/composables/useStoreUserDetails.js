import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

export async function useStoreUserDetails() {
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
    return
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
    return
  }

  // const eventIndex = localEvents.value.findIndex((e) => e.id === event.id)
  // if (eventIndex === -1) return

  if (existing) {
    toast.info('You are already registered for this event')
    // localEvents.value[eventIndex].is_interest = true
    return
  } else {
    const { error: insertError } = await supabase
      .from('registered_events')
      .insert([{ user_id: user.id, event_id: event.id }])

    if (insertError) {
      toast.error(insertError.message)
      return { success: false }
    }

    toast.success('Registration successful')
    try {
      await fetch('/api/registration_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata.full_name,
          event: event,
        }),
      });
    } catch (error) {
      // toast.error('An error occurred. Please try again.')
      console.log('error sending registration email', error)
    }

    return { success: true }
    // localEvents.value[eventIndex].is_interest = true
  }


}
 return {
    addUserToEvent
  }
}
