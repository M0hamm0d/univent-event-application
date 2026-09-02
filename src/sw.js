/* eslint-disable no-undef */
/**
 * UniVent Custom Service Worker
 *
 * Handles:
 *   - Workbox-powered precaching (injected by vite-plugin-pwa at build time)
 *   - Push notification display
 *   - Notification click → deep link to event page
 *   - Subscription change detection
 */

// Workbox precaching — injected by vite-plugin-pwa build.
// These imports are replaced with the actual manifest during build.
// __WB_MANIFEST is the self.__WB_MANIFEST replacement used by workbox.
// In dev mode this is empty; in production it contains the precache manifest.
 
const WB_MANIFEST = self.__WB_MANIFEST || []

// Import and set up Workbox precaching if the manifest has entries.
if (WB_MANIFEST && WB_MANIFEST.length > 0) {
  import('workbox-precaching').then(({ precacheAndRoute }) => {
    precacheAndRoute(WB_MANIFEST)
  })
}

// Import and set up Workbox routing for runtime caching.
import('workbox-routing').then(({ registerRoute }) => {
  import('workbox-strategies').then(({ NetworkFirst }) => {
    // Cache Supabase REST API responses (NetworkFirst — try network, fall back to cache).
    registerRoute(
      ({ url }) =>
        url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),
      new NetworkFirst({
        cacheName: 'supabase-rest-cache',
        networkTimeoutSeconds: 3,
        plugins: [
          {
            cacheDidUpdate: async ({ cache }) => {
              // Limit cache size.
              const keys = await cache.keys()
              if (keys.length > 100) {
                await cache.delete(keys[0])
              }
            },
          },
        ],
      }),
    )
  })
})

// ============================================================================
// Push Notification Handler
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    // If the payload isn't JSON, show a generic notification.
    payload = {
      title: 'UniVent',
      body: event.data.text(),
      url: '/discover',
    }
  }

  const { title, body, icon, image, url, tag, renotify } = payload

  const options = {
    body: body || '',
    icon: icon || '/icons/android-icon-192x192.png',
    badge: '/icons/web-icon.png',
    image: image || undefined,
    tag: tag || 'univent-notification',
    renotify: renotify !== false, // default true — vibrate on update
    vibrate: [200, 100, 200],
    data: {
      url: url || '/discover',
      receivedAt: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  }

  event.waitUntil(self.registration.showNotification(title || 'UniVent', options))
})

// ============================================================================
// Notification Click Handler
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // If user clicked "Dismiss", do nothing.
  if (event.action === 'dismiss') return

  const urlToOpen = event.notification.data?.url || '/discover'

  // Focus existing window if open, otherwise open new one.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window with UniVent open.
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL and focus.
          return client.navigate(urlToOpen).then(() => client.focus())
        }
      }
      // No existing window — open a new one.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }),
  )
})

// ============================================================================
// Push Subscription Change Handler
// ============================================================================

self.addEventListener('pushsubscriptionchange', (event) => {
  // The browser subscription expired or was revoked.
  // Re-subscribe and update the server.
  event.waitUntil(
    (async () => {
      try {
        // Try to re-subscribe with the same options.
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription ? event.oldSubscription.options : undefined,
        )

        // Update the server with the new subscription.
        const response = await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh: subscription.toJSON().keys.p256dh,
            auth: subscription.toJSON().keys.auth,
          }),
        })

        if (!response.ok) {
          console.error('pushsubscriptionchange: failed to update server subscription')
        }
      } catch (err) {
        console.error('pushsubscriptionchange: re-subscription failed:', err)
      }
    })(),
  )
})
