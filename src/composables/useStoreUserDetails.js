import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

export function useStoreUserDetails() {
  const toast = useToast()
  const loading = ref(false)

  // registerForEvent: atomic server-side registration + waitlist assignment.
  // Calls the register_for_event RPC, which locks the event row, counts real
  // registered_events rows, and inserts into registered_events or waiting_list.
  // Returns { success, status } where status is one of:
  //   'registered' | 'waitlisted' | 'already_registered' | 'already_waitlisted' | 'closed'
  async function registerForEvent(event) {
    loading.value = true
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in')
        return { success: false }
      }

      const { data: userName } = await supabase
        .from('profile')
        .select('user_name')
        .eq('id', user.id)
        .maybeSingle()

      const { data, error } = await supabase.rpc('register_for_event', {
        p_event_id: event.id,
        p_user_id: user.id,
      })

      if (error) {
        toast.error(error.message)
        return { success: false }
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data
      const status = result?.status

      if (status === 'already_registered') {
        toast.info('You are already registered for this event')
        return { success: true, status: 'registered' }
      }
      if (status === 'already_waitlisted') {
        toast.info('You are already on the waiting list for this event')
        return { success: true, status: 'waitlisted' }
      }
      if (status === 'closed') {
        toast.error('Registration for this event is closed')
        return { success: false, status: 'closed' }
      }
      if (status === 'registered') {
        toast.success('Registration successful')
        try {
          await fetch('/api/registration_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: userName?.user_name,
              event,
            }),
          })
        } catch (err) {
          console.error('Error sending registration email:', err)
        }
        return { success: true, status: 'registered' }
      }
      if (status === 'waitlisted') {
        toast.success(`Added to the waiting list (position ${result.position ?? '?'})`)
        try {
          await fetch('/api/confirm_waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: userName?.user_name,
              event,
            }),
          })
        } catch (err) {
          console.error('Error sending waitlist email:', err)
        }
        return { success: true, status: 'waitlisted' }
      }

      toast.error('Unexpected registration response')
      return { success: false }
    } catch (err) {
      console.error('registerForEvent error:', err)
      toast.error(err?.message || 'Registration failed')
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  // cancelRegistration: atomic server-side cancellation + waitlist promotion.
  // Calls the cancel_registration RPC, which marks the registered_events row
  // cancelled and promotes the oldest waitlisted student to registered in the
  // same transaction, returning the promoted user's id (so we email them).
  async function cancelRegistration(event) {
    loading.value = true
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('You must be logged in')
        return { success: false }
      }

      const { data, error } = await supabase.rpc('cancel_registration', {
        p_event_id: event.id,
        p_user_id: user.id,
      })

      if (error) {
        // "You are not registered" surfaces as a PostgREST exception message.
        toast.info(error.message)
        return { success: false }
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data
      const status = result?.status

      if (status === 'left_waitlist') {
        toast.success('Removed from the waiting list')
        return { success: true, status: 'left_waitlist' }
      }
      if (status === 'cancelled') {
        toast.success('Your registration has been cancelled')
        // Notify the promoted student (if any) via the existing email endpoint.
        const promotedUserId = result?.promoted_user_id
        if (promotedUserId) {
          try {
            const { data: promotedProfile } = await supabase
              .from('profile')
              .select('user_email, user_name')
              .eq('id', promotedUserId)
              .maybeSingle()
            if (promotedProfile) {
              await fetch('/api/registration_email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: promotedProfile.user_email,
                  name: promotedProfile.user_name,
                  event,
                }),
              })
            }
          } catch (err) {
            console.error('Error notifying promoted student:', err)
          }
        }
        return { success: true, status: 'cancelled', promoted_user_id: promotedUserId }
      }

      toast.error('Unexpected cancellation response')
      return { success: false }
    } catch (err) {
      console.error('cancelRegistration error:', err)
      toast.error(err?.message || 'Cancellation failed')
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  return {
    registerForEvent,
    cancelRegistration,
  }
}
