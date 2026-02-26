import { supabase } from '@/supabase'
import { ref } from 'vue'

export function useUserProfile() {
  const loading = ref(false)
  const error = ref(null)
  const profile = ref(null)

  const fetchProfile = async (userId) => {
    loading.value = true
    error.value = null
    profile.value = null

    try {
      const { data, error: supabaseError } = await supabase
        .from('profile')
        .select('*')
        .eq('id', userId)
        .single()

      if (supabaseError) {
        error.value = supabaseError.message
        return { success: false, error: supabaseError.message }
      }

      profile.value = data
      return { success: true, data }
    } catch (err) {
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }
  async function ensureProfile(user) {
    const { data: existingUser, error } = await supabase
      .from('profile')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error(error.message)
      return null
    }

    if (!existingUser) {
      console.log('no existing user')
      const name = user.user_metadata?.full_name || user.user_metadata?.name || 'User'

      const { data: insertedProfile, error: insertError } = await supabase
        .from('profile')
        .insert({
          id: user.id,
          user_name: name,
          user_email: user.email,
        })
        .select()
        .single()

      if (insertError) {
        console.error(insertError.message)
        return null
      }

      return insertedProfile
    }
    return existingUser
  }

  return {
    loading,
    error,
    profile,
    fetchProfile,
    ensureProfile,
  }
}
