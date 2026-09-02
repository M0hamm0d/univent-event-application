import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useUserProfile } from '@/composables/useUserProfile'
import { withAuthHeader } from '@/composables/useApiAuth'

let initPromise = null
const isInitialized = ref(false)

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
    univentStore.imageUrl = profileResult?.profile_pics || null

    // Check push subscription state so Settings reflects reality on load.
    try {
      const res = await fetch('/api/push-subscribe', await withAuthHeader())
      if (res.ok) {
        const data = await res.json()
        univentStore.pushSubscribed = data.subscribed || false
        univentStore.pushSubscriptionCount = data.count || 0
      }
    } catch {
      // Non-critical — push settings will load on demand if this fails.
    }
  } else {
    univentStore.userProfile = {}
    univentStore.imageUrl = null
  }

  isInitialized.value = true
}

export function ensureSessionInit() {
  if (!initPromise) {
    initPromise = runInit()
  }
  return initPromise
}

export async function resetSessionInit() {
  // Await any in-flight init so a second init can't overlap the first and
  // write userProfile/isAuthenticated out of order.
  if (initPromise) {
    try {
      await initPromise
    } catch {
      // ignore — we're resetting anyway
    }
  }
  initPromise = null
  isInitialized.value = false
}

export function useSessionInit() {
  return { ensureSessionInit, resetSessionInit, isInitialized }
}