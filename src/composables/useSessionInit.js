import { ref } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useUserProfile } from '@/composables/useUserProfile'

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
      const { count, error: countErr } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      if (!countErr) {
        univentStore.pushSubscriptionCount = count || 0
        univentStore.pushSubscribed = (count || 0) > 0
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