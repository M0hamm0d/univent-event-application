import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

/**
 * useFormSubmission
 * Student-side composable for custom registration forms (MODE 2 events).
 *
 * Mirrors useStoreUserDetails.registerForEvent so the caller gets the SAME
 * status contract the no-form path returns:
 *   { success, status: 'registered' | 'waitlisted' | 'already_registered' |
 *                      'already_waitlisted' | 'closed' | 'form_outdated' }
 * plus `position` for waitlisted and the existing email behaviour
 * (POST /api/registration_email or /api/confirm_waitlist). This keeps Stage 6E
 * email integration identical to MODE 1 without a duplicate email system.
 *
 * It does NOT touch capacity itself — register_with_form is the atomic
 * SECURITY DEFINER RPC that does capacity/waitlist + form-response insert in
 * one transaction (Stage 6A). The frontend never decides registered vs
 * waitlisted.
 *
 * Exposed:
 *   submitForm(event, formVersionId, answers)  -> new submission
 *   loadOwnResponse(eventId)                  -> prefill for edit
 *   updateForm(eventId, answers)              -> edit existing answers
 *   hasCustomForm(eventId)                    -> used by EventsCard routing
 */

export function useFormSubmission() {
  const toast = useToast()
  const loading = ref(false)

  // Resolve the authenticated user + their profile row once per action so we
  // can fire the existing email endpoints with { email, name }.
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
      await fetch('/api/registration_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: profile?.user_name,
          event,
        }),
      })
    } catch (err) {
      console.error('Error sending registration email:', err)
    }
  }

  async function fireWaitlistEmail(user, profile, event) {
    try {
      await fetch('/api/confirm_waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: profile?.user_name,
          event,
        }),
      })
    } catch (err) {
      console.error('Error sending waitlist email:', err)
    }
  }

  /**
   * submitForm(event, formVersionId, answers)
   *   New submission against a published custom form. Calls register_with_form
   *   which atomically validates the answers, runs the capacity/waitlist
   *   decision, and upserts registration_form_responses. Returns the same
   *   status contract as useStoreUserDetails.registerForEvent so EventsCard's
   *   onRegisterClick handler works unchanged.
   *   `formVersionId` may be null — the RPC uses the form's current published
   *   version in that case. If a stale id is supplied the RPC returns
   *   'form_outdated' so the client can refresh and refill.
   */
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
        // RPC RAISEs (e.g. validation, "registration is not open", "not auth'd")
        // surface as a PostgREST exception message.
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

  /**
   * loadOwnResponse(eventId)
   *   Student reads their own already-submitted response via the
   *   get_form_response_for_user RPC. Used to prefill the editor. Returns the
   *   answers + the version fields the answers were submitted against so the
   *   client can render labels/options correctly. Returns null when the
   *   student has not submitted for this event yet.
   */
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

  /**
   * updateForm(eventId, answers)
   *   Edit an already-submitted response via update_form_response. The RPC
   *   re-validates, enforces "registration must be open", and NEVER touches
   *   registered_events / waiting_list — so it cannot change the student's
   *   status or waitlist position. It returns the previously-referenced file
   *   paths that are no longer used so the client can clean them up (Stage 6G
   *   wires the storage remove() calls). For text fields this returns
   *   { success: true }.
   */
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

  /**
   * hasCustomForm(eventId)
   *   Light probe used by EventsCard to decide which modal to open. Returns
   *   the published form payload (title/description/fields/form_version_id) or
   *   null when the event has no published custom form. Same RPC the student
   *   form modal uses to render, so there's no drift. Cache the result per
   *   event in the caller (EventsCard keeps a `hasCustomFormMap`).
   */
  async function hasCustomForm(eventId) {
    if (!eventId) return null
    try {
      const { data, error } = await supabase.rpc('get_active_registration_form', {
        p_event_id: eventId,
      })
      if (error) return null
      const result = typeof data === 'string' ? JSON.parse(data) : data
      return result || null
    } catch (err) {
      console.error('hasCustomForm error:', err)
      return null
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