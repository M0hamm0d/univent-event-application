import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { ref } from 'vue'

export function useAuth(toast) {
  const uniVentStore = useUniventStore()
  const errorMessage = ref('')
  const signUpForm = ref({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  function showError(error) {
    errorMessage.value = error
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }
  async function signupBtn(name, email, password, confirmPassword) {
    signUpForm.value = {
      name,
      email,
      password,
      confirmPassword,
    }
    if (!name || !email || !password || !confirmPassword) {
      showError('No field must be empty')
      return
    }
    if (password.length < 6) {
      showError('password must at least be 6 character')
      return
    }
    if (password != confirmPassword) {
      showError('password do not match')
      return
    }
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/
    if (!strongPassword.test(password)) {
      showError('Password must include uppercase, lowercase, number, and special character')
      return
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email)) {
      showError('Please enter a valid email address')
      return
    }
    try {
      let { data, error: supabaseError } = await supabase.auth.signUp({
        email,
        password,
        data: { full_name: name },
      })
      if (supabaseError) {
        showError(supabaseError.message)
        return
      }
      const userId = data.user.id
      if (userId) {
        const { error: insertError } = await supabase.from('profile').insert({
          id: userId,
          user_name: signUpForm.value.name,
          user_email: signUpForm.value.email,
        })
        if (insertError) {
          console.error('Profile insert failed after signup:', insertError.message)
          showError('Account created but profile setup failed. Please contact support.')
          return { success: false }
        }
        // Email confirmation is required: do NOT set isAuthenticated=true
        // or populate userProfile here. The user must verify their email and
        // then sign in. Show a clear notice instead.
        uniVentStore.signupModal = false
        toast?.success('Account created! Check your email to verify your account before signing in.')
        return { success: true }
      }
    } catch (err) {
      console.error(err)
      showError('Something went wrong. Please try again.')
      return { success: false }
    }
  }
  async function signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        toast?.error(error ? error.message : 'Login failed')
        return { success: false, error: error ? error.message : 'Login failed' }
      }

      const { data: profile, error: profileError } = await supabase
        .from('profile')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()

      // If the profile row is missing (e.g. signup insert failed or an OAuth
      // user without a profile), create a minimal one so downstream components
      // that read userProfile.id don't crash.
      let finalProfile = profile
      if (!finalProfile && !profileError) {
        const { data: inserted, error: insertError } = await supabase
          .from('profile')
          .insert({
            id: data.user.id,
            user_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'User',
            user_email: data.user.email,
          })
          .select()
          .maybeSingle()
        if (insertError) {
          console.error('Failed to create missing profile on login:', insertError.message)
        } else {
          finalProfile = inserted
        }
      }

      uniVentStore.isAuthenticated = true
      uniVentStore.userProfile = finalProfile || {}
      uniVentStore.imageUrl = finalProfile?.profile_pics || null
      uniVentStore.loginModal = false

      toast?.success('Logged in successfully')

      return { success: true, user: data.user }
    } catch (err) {
      toast?.error('Something went wrong. Please try again.')
      return { success: false, error: err.message }
    }
  }

  async function logout() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.log('No session, skipping logout')
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
      toast?.error('Sign out failed')
      return false
    }
    // Reset store immediately so the UI reflects logout without waiting for
    // the async SIGNED_OUT auth event (which may be delayed or missed).
    uniVentStore.$reset()
    uniVentStore.isAuthenticated = false
    toast?.success('Signed out successfully')
    return true
  }

  return { signIn, logout, signupBtn, errorMessage }
}
