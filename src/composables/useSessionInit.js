import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useUserProfile } from '@/composables/useUserProfile'

let initPromise = null
const isInitialized = ref(false)

// Runs the app-level session/profile hydration exactly once per active
// session. A cached promise guards against concurrent callers (router guard
// + App.vue onMounted firing at the same time). Reset on sign-out so a fresh
// login re-hydrates.
async function runInit() {
  const univentStore = useUniventStore()
  const { ensureProfile } = useUserProfile()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  univentStore.isAuthenticated = !!session?.user

  if (session?.user) {
    const profileResult = await ensureProfile(session.user)
    univentStore.userProfile = profileResult
  } else {
    univentStore.userProfile = {}
  }

  isInitialized.value = true
}

export function ensureSessionInit() {
  if (!initPromise) {
    initPromise = runInit()
  }
  return initPromise
}

export function resetSessionInit() {
  initPromise = null
  isInitialized.value = false
}

export function useSessionInit() {
  return { ensureSessionInit, resetSessionInit, isInitialized }
}