import { ref, computed } from 'vue'
import { supabase } from '@/supabase'

/**
 * Composable for managing Web Push subscriptions.
 *
 * Provides:
 *   - isSupported: whether Push API + Notification API are available
 *   - permissionState: current Notification.permission value
 *   - isSubscribed: whether this browser has an active subscription on the server
 *   - subscriptionCount: how many devices/browsers the user has subscribed
 *   - subscriptions: list of subscription metadata from the server
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
  const subscriptions = ref([])
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
    // Wait for the SW to be ready.
    return navigator.serviceWorker.ready
  }

  /**
   * Check the current subscription state from the server.
   */
  async function checkSubscription() {
    if (!isSupported.value) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        isSubscribed.value = false
        subscriptionCount.value = 0
        subscriptions.value = []
        return
      }

      const res = await fetch('/api/push-subscribe', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!res.ok) {
        console.error('checkSubscription: server returned', res.status)
        return
      }

      const data = await res.json()
      isSubscribed.value = data.subscribed || false
      subscriptionCount.value = data.count || 0
      subscriptions.value = data.subscriptions || []
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
   * 3. Save the subscription to the server
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

      // 3. Save to server.
      const subJson = subscription.toJSON()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        error.value = 'You must be logged in to enable push notifications.'
        return false
      }

      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Failed to save subscription on server')
      }

      // 4. Update state.
      await checkSubscription()
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
   * 3. Remove the subscription from the server
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

      // 3. Remove from server.
      if (endpoint) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch('/api/push-subscribe', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ endpoint }),
          })
        }
      }

      // 4. Update state.
      await checkSubscription()
      return true
    } catch (err) {
      console.error('disablePush error:', err)
      error.value = err.message || 'Failed to disable push notifications.'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    isSupported,
    permissionState,
    hasPermission,
    isDenied,
    isSubscribed,
    subscriptionCount,
    subscriptions,
    loading,
    error,
    checkSubscription,
    enablePush,
    disablePush,
  }
}
