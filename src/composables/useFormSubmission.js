import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import { withAuthHeader } from '@/composables/useApiAuth'

export function useFormSubmission() {
  const toast = useToast()
  const loading = ref(false)

  async function resolveUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error('You must be logged in')
      return null
    }
    const { data: profile } = await supabase
      .from('profile')
      .select('user_name')
      .eq('id', user.id)
      .maybeSingle()
    return { user, profile }
  }

  async function fireRegistrationEmail(user, profile, event) {
    try {
      await fetch('/api/registration_email', await withAuthHeader({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: profile?.user_name,
          event,
        }),
      }))
    } catch (err) {
      console.error('Error sending registration email:', err)
    }
  }

  async function fireWaitlistEmail(user, profile, event) {
    try {
      await fetch('/api/confirm_waitlist', await withAuthHeader({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: profile?.user_name,
          event,
        }),
      }))
    } catch (err) {
      console.error('Error sending waitlist email:', err)
    }
  }

  async function submitForm(event, formVersionId, answers) {
    loading.value = true
    try {
      const resolved = await resolveUser()
      if (!resolved) return { success: false }
      const { user, profile } = resolved

      const { data, error } = await supabase.rpc('register_with_form', {
        p_event_id: event.id,
        p_form_version_id: formVersionId || null,
        p_form_data: answers,
      })

      if (error) {
        toast.error(error.message)
        return { success: false }
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data
      const status = result?.status

      if (status === 'form_outdated') {
        toast.info('The form was just updated. Please review and submit again.')
        return { success: false, status: 'form_outdated' }
      }
      if (status === 'already_registered') {
        toast.info('You are already registered for this event')
        return { success: false, status: 'already_registered' }
      }
      if (status === 'already_waitlisted') {
        toast.info('You are already on the waiting list for this event')
        return { success: false, status: 'already_waitlisted' }
      }
      if (status === 'closed') {
        toast.error('Registration for this event is closed')
        return { success: false, status: 'closed' }
      }
      if (status === 'registered') {
        toast.success('Registration successful')
        await fireRegistrationEmail(user, profile, event)
        return { success: true, status: 'registered' }
      }
      if (status === 'waitlisted') {
        toast.success(`Added to the waiting list (position ${result.position ?? '?'})`)
        await fireWaitlistEmail(user, profile, event)
        return { success: true, status: 'waitlisted', position: result.position }
      }

      toast.error('Unexpected registration response')
      return { success: false }
    } catch (err) {
      console.error('submitForm error:', err)
      toast.error(err?.message || 'Registration failed')
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  async function loadOwnResponse(eventId) {
    try {
      const { data, error } = await supabase.rpc('get_form_response_for_user', {
        p_event_id: eventId,
      })
      if (error) {
        toast.error(error.message)
        return null
      }
      const result = typeof data === 'string' ? JSON.parse(data) : data
      return result || null
    } catch (err) {
      console.error('loadOwnResponse error:', err)
      toast.error(err?.message || 'Could not load your response')
      return null
    }
  }

  async function updateForm(eventId, answers) {
    loading.value = true
    try {
      const { data, error } = await supabase.rpc('update_form_response', {
        p_event_id: eventId,
        p_form_data: answers,
      })
      if (error) {
        toast.error(error.message)
        return { success: false }
      }
      const result = typeof data === 'string' ? JSON.parse(data) : data
      toast.success('Your response has been updated')
      return {
        success: true,
        removedFilePaths: result?.removed_file_paths || [],
      }
    } catch (err) {
      console.error('updateForm error:', err)
      toast.error(err?.message || 'Could not update your response')
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  async function hasCustomForm(eventId) {
    if (!eventId) return { form: null, error: null }
    try {
      const { data, error } = await supabase.rpc('get_active_registration_form', {
        p_event_id: eventId,
      })
      if (error) {
        console.error('hasCustomForm rpc error:', error)
        return { form: null, error: 'fetch_failed' }
      }
      const result = typeof data === 'string' ? JSON.parse(data) : data
      return { form: result || null, error: null }
    } catch (err) {
      console.error('hasCustomForm error:', err)
      return { form: null, error: 'fetch_failed' }
    }
  }

  return {
    loading,
    submitForm,
    loadOwnResponse,
    updateForm,
    hasCustomForm,
  }
}
