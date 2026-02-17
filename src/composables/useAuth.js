// composables/useAuth.js
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
      })
      if (supabaseError) {
        showError(supabaseError.message)
        return
      }
      const userId = data.user.id
      if (userId) {
        await supabase.from('profile').insert({
          id: userId,
          user_name: signUpForm.value.name,
          user_email: signUpForm.value.email,
        })
        uniVentStore.signupModal = false
        uniVentStore.userProfile.user_name = name
        uniVentStore.isAuthenticated = true
        toast?.success('Account created successfully.')
        return { success: true }
      }
    } catch (err) {
      console.error(err)
      showError('Something went wrong. Please try again.')
      return { success: false }
    }
  }
  //
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

      const { data: profile } = await supabase
        .from('profile')
        .select('*')
        .eq('id', data.user.id)
        .single()

      uniVentStore.isAuthenticated = true
      uniVentStore.userProfile = profile
      uniVentStore.imageUrl = profile?.profile_pics || null
      uniVentStore.loginModal = false

      toast?.success('Logged in successfully')

      return { success: true, user: data.user }
    } catch (err) {
      toast?.error('Something went wrong. Please try again.')
      return { success: false, error: err.message }
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
      toast?.error('Sign out failed')
      return false
    }
    uniVentStore.$reset()
    toast?.success('Signed out successfully')
    uniVentStore.isAuthenticated = false
    return true
  }

  return { signIn, logout, signupBtn, errorMessage }
}
