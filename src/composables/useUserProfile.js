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

  return {
    loading,
    error,
    profile,
    fetchProfile,
  }
}
