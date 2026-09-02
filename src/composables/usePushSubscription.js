import { ref, computed } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'

/**
 * Composable for managing Web Push subscriptions.
 *
 * Uses the Supabase client directly against the push_subscriptions table
 * (RLS allows users to manage their own rows). No serverless endpoint needed.
 *
 * Provides:
 *   - isSupported: whether Push API + Notification API are available
 *   - permissionState: current Notification.permission value
 *   - isSubscribed: whether this browser has an active subscription on the server
 *   - subscriptionCount: how many devices/browsers the user has subscribed
 *   - enablePush(): subscribe to push notifications
 *   - disablePush(): unsubscribe from push notifications
 *   - checkSubscription(): refresh subscription state from server
 *
 * Push is OFF by default. The user must explicitly enable it in Settings.
 */
export function usePushSubscription() {
  const isSupported = ref(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      'PushManager' in window &&
      'serviceWorker' in navigator,
  )

  const permissionState = ref(
    isSupported.value ? Notification.permission : 'denied',
  )

  const isSubscribed = ref(false)
  const subscriptionCount = ref(0)
  const loading = ref(false)
  const error = ref(null)

  const hasPermission = computed(() => permissionState.value === 'granted')
  const isDenied = computed(() => permissionState.value === 'denied')

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  /**
   * Convert a VAPID public key (base64url) to a Uint8Array for the Push API.
   */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  /**
   * Get the current service worker registration.
   */
  async function getSWRegistration() {
    if (!('serviceWorker' in navigator)) return null
    return navigator.serviceWorker.ready
  }

  /**
   * Get the current push endpoint from the browser's PushManager.
   */
  async function getCurrentEndpoint() {
    const registration = await getSWRegistration()
    if (!registration) return null
    const subscription = await registration.pushManager.getSubscription()
    return subscription ? subscription.endpoint : null
  }

  /**
   * Check the current subscription state from the Supabase push_subscriptions table.
   */
  async function checkSubscription() {
    if (!isSupported.value) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        isSubscribed.value = false
        subscriptionCount.value = 0
        return
      }

      // Check if this browser's endpoint exists in push_subscriptions.
      const endpoint = await getCurrentEndpoint()

      if (endpoint) {
        const { data, error: dbError } = await supabase
          .from('push_subscriptions')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('endpoint', endpoint)
          .maybeSingle()

        if (!dbError) {
          isSubscribed.value = !!data
        }
      } else {
        isSubscribed.value = false
      }

      // Get total subscription count for this user.
      const { count, error: countError } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (!countError) {
        subscriptionCount.value = count || 0
      }
    } catch (err) {
      console.error('checkSubscription error:', err)
    }
  }

  /**
   * Enable push notifications for this browser/device.
   *
   * Flow:
   * 1. Request browser notification permission
   * 2. Get or create a PushSubscription via the Push API
   * 3. Save the subscription to push_subscriptions table via Supabase
   * 4. Update local state
   */
  async function enablePush() {
    if (!isSupported.value) {
      error.value = 'Push notifications are not supported in this browser.'
      return false
    }

    if (!vapidPublicKey) {
      error.value = 'Push notifications are not configured on the server.'
      return false
    }

    loading.value = true
    error.value = null

    try {
      // 1. Request permission.
      const permission = await Notification.requestPermission()
      permissionState.value = permission

      if (permission !== 'granted') {
        error.value =
          permission === 'denied'
            ? 'Notification permission was denied. Please enable notifications in your browser settings and try again.'
            : 'Notification permission was dismissed. Please allow notifications to enable push alerts.'
        return false
      }

      // 2. Get the service worker registration and subscribe.
      const registration = await getSWRegistration()
      if (!registration) {
        error.value = 'Service worker is not available. Please reload the page.'
        return false
      }

      // Check for an existing subscription.
      let subscription = await registration.pushManager.getSubscription()

      // Create a new subscription if one doesn't exist.
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      // 3. Save to Supabase push_subscriptions table.
      const subJson = subscription.toJSON()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        error.value = 'You must be logged in to enable push notifications.'
        return false
      }

      const { error: upsertError } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: subJson.keys.p256dh,
            auth_key: subJson.keys.auth,
            user_agent: navigator.userAgent,
          },
          { onConflict: 'user_id,endpoint' },
        )

      if (upsertError) {
        throw new Error(upsertError.message || 'Failed to save subscription')
      }

      // 4. Update state.
      await checkSubscription()
      syncStore()
      return true
    } catch (err) {
      console.error('enablePush error:', err)
      error.value = err.message || 'Failed to enable push notifications.'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Disable push notifications for this browser/device.
   *
   * Flow:
   * 1. Get the current PushSubscription
   * 2. Unsubscribe from the Push API
   * 3. Remove the subscription from push_subscriptions table via Supabase
   * 4. Update local state
   */
  async function disablePush() {
    loading.value = true
    error.value = null

    try {
      // 1. Get current subscription from the browser.
      const registration = await getSWRegistration()
      let endpoint = null

      if (registration) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          endpoint = subscription.endpoint
          // 2. Unsubscribe from the Push API.
          await subscription.unsubscribe()
        }
      }

      // 3. Remove from Supabase push_subscriptions table.
      if (endpoint) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint)
        }
      }

      // 4. Update state.
      await checkSubscription()
      syncStore()
      return true
    } catch (err) {
      console.error('disablePush error:', err)
      error.value = err.message || 'Failed to disable push notifications.'
      return false
    } finally {
      loading.value = false
    }
  }

  /** Sync local state to the Pinia store. */
  function syncStore() {
    try {
      const store = useUniventStore()
      store.pushSubscribed = isSubscribed.value
      store.pushSubscriptionCount = subscriptionCount.value
    } catch {
      // Store may not be available in non-component contexts.
    }
  }

  return {
    isSupported,
    permissionState,
    hasPermission,
    isDenied,
    isSubscribed,
    subscriptionCount,
    loading,
    error,
    checkSubscription,
    enablePush,
    disablePush,
  }
}
