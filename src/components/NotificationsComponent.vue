<script setup>
import { onMounted } from 'vue'
import { usePushSubscription } from '@/composables/usePushSubscription'
import { useUniventStore } from '@/stores/counter'
import { useToast } from 'vue-toastification'

const toast = useToast()
const store = useUniventStore()
const {
  isSupported,
  isDenied,
  isSubscribed,
  subscriptionCount,
  loading,
  error,
  checkSubscription,
  enablePush,
  disablePush,
} = usePushSubscription()

onMounted(async () => {
  // Sync from store (populated on login) so the toggle shows correct state
  // before the API round-trip completes.
  isSubscribed.value = store.pushSubscribed
  subscriptionCount.value = store.pushSubscriptionCount
  await checkSubscription()
})

async function handleTogglePush() {
  if (isSubscribed.value) {
    const success = await disablePush()
    if (success) {
      toast.success('Push notifications disabled')
    } else if (error.value) {
      toast.error(error.value)
    }
  } else {
    const success = await enablePush()
    if (success) {
      toast.success('Push notifications enabled')
    } else if (error.value) {
      toast.error(error.value)
    }
  }
}

// Re-check subscription state when returning to the page.
// Browser permission changes are detected when the user interacts with the toggle.
</script>

<template>
  <div class="notifications-wrapper">
    <div class="notifications-header">
      <h3>Notifications</h3>
      <p>Manage how you receive event reminders and updates.</p>
    </div>

    <div class="notifications-body">
      <!-- Push Notifications Section -->
      <div class="notification-channel">
        <div class="channel-info">
          <div class="channel-header">
            <h4>Push Notifications</h4>
            <span :class="['status-badge', isSubscribed ? 'active' : 'inactive']">
              {{ isSubscribed ? 'Active' : 'Off' }}
            </span>
          </div>
          <p class="channel-description">
            Get instant browser notifications for event reminders (1 day and 1 hour before),
            waitlist promotions, and date changes — even when you're not on the UniVent website.
          </p>
        </div>

        <!-- Browser not supported -->
        <div v-if="!isSupported" class="channel-warning">
          <div class="warning-icon">⚠️</div>
          <div class="warning-text">
            <p><strong>Not supported</strong></p>
            <p>Push notifications are not supported in this browser. Please use Chrome, Firefox, Edge, or Safari (iOS 16.4+).</p>
          </div>
        </div>

        <!-- Permission denied -->
        <div v-else-if="isDenied" class="channel-warning denied">
          <div class="warning-icon">🔕</div>
          <div class="warning-text">
            <p><strong>Notifications blocked</strong></p>
            <p>
              You've blocked notification permissions for UniVent. To enable push notifications:
            </p>
            <ol>
              <li>Click the lock/site-settings icon in your browser's address bar</li>
              <li>Set "Notifications" to "Allow"</li>
              <li>Reload this page and try again</li>
            </ol>
          </div>
        </div>

        <!-- Toggle (when supported and not denied) -->
        <div v-else class="channel-toggle">
          <label class="toggle-switch">
            <input
              type="checkbox"
              :checked="isSubscribed"
              :disabled="loading"
              @change="handleTogglePush"
            />
            <span class="toggle-slider"></span>
          </label>
          <div class="toggle-label">
            <span v-if="loading">
              {{ isSubscribed ? 'Disabling...' : 'Enabling...' }}
            </span>
            <span v-else>
              {{ isSubscribed ? 'Push notifications are on' : 'Enable push notifications' }}
            </span>
          </div>
        </div>

        <!-- Device count info -->
        <div v-if="isSubscribed && subscriptionCount > 1" class="device-info">
          <p>
            Active on {{ subscriptionCount }} device{{ subscriptionCount > 1 ? 's' : '' }}.
            This browser is subscribed.
          </p>
        </div>

        <!-- Error message -->
        <div v-if="error" class="channel-error">
          <p>{{ error }}</p>
        </div>
      </div>

      <!-- Email Notifications Section (read-only, informational) -->
      <div class="notification-channel">
        <div class="channel-info">
          <div class="channel-header">
            <h4>Email Notifications</h4>
            <span class="status-badge active">Always On</span>
          </div>
          <p class="channel-description">
            Event reminders, registration confirmations, waitlist updates, and date changes
            are always sent to your registered email address. Email notifications cannot be
            disabled as they serve as a reliable backup channel.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-wrapper {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

h3, h4, p {
  padding: 0;
  margin: 0;
}

.notifications-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notifications-header p {
  color: #959595;
}

.notifications-body {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.notification-channel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channel-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-header h4 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.channel-description {
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

/* Status badges */
.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.inactive {
  background: #f1f5f9;
  color: #94a3b8;
}

/* Toggle switch */
.channel-toggle {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 4px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider::before {
  position: absolute;
  content: '';
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #1969fe;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(22px);
}

.toggle-switch input:disabled + .toggle-slider {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}

/* Warning blocks */
.channel-warning {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 8px;
}

.channel-warning.denied {
  background: #fef2f2;
  border-color: #fca5a5;
}

.warning-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.warning-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.warning-text p {
  font-size: 14px;
  color: #92400e;
  line-height: 1.4;
}

.channel-warning.denied .warning-text p {
  color: #991b1b;
}

.warning-text ol {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #991b1b;
  line-height: 1.6;
}

/* Device info */
.device-info {
  padding: 10px 14px;
  background: #eff6ff;
  border-radius: 8px;
}

.device-info p {
  font-size: 13px;
  color: #3b82f6;
}

/* Error */
.channel-error {
  padding: 10px 14px;
  background: #fef2f2;
  border-radius: 8px;
}

.channel-error p {
  font-size: 13px;
  color: #dc2626;
}
</style>
