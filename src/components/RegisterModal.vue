<script setup>
import { ref, computed } from 'vue'
import { useStoreUserDetails } from '@/composables/useStoreUserDetails'
import { useUniventStore } from '@/stores/counter'

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
  local_Events: ref([]),
  showModal: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'registered'])
const loading = ref(false)

const univentStore = useUniventStore()
const isLoggedIn = computed(() => univentStore.isAuthenticated)

function openLogin() {
  univentStore.loginModal = true
  emit('close')
}
function cancel() {
  emit('close')
}
async function agree() {
  loading.value = true
  const { addUserToEvent } = useStoreUserDetails()
  const result = await addUserToEvent(props.event, props.local_Events)
  loading.value = false
  if (result.success) {
    emit('close')
    emit('registered')
  } else {
    emit('close')
  }
}
</script>
<template>
  <div v-if="showModal" class="modal-overlay" @click="emit('close')">
    <div class="modal-card" @click.stop>
      <div class="icon-container">
        <div class="icon-circle">
          <span class="icon-inner">!</span>
        </div>
      </div>

      <div class="modal-body" v-if="!isLoggedIn">
        <h2>Login Required</h2>
        <p>You must be logged in to register for an event.</p>

        <div class="modal-actions single-btn">
          <button class="btn-primary" @click="openLogin">Go to Login</button>
        </div>
      </div>

      <div class="modal-body" v-else>
        <h2>Register?</h2>
        <p class="main-text">You're about to register for this event.</p>
        <p class="sub-text">
          We’ll share your name, email, and phone number with the organizer so they can reserve your
          spot.
        </p>

        <div class="modal-actions">
          <button class="btn-outline" @click="cancel">Cancel</button>
          <button class="btn-confirm" @click="agree" :disabled="loading">
            {{ loading ? 'Processing...' : 'Yes, I Agree' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Overlay with a subtle blur */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.1);
  /* backdrop-filter: blur(2px); */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* The White Card */
.modal-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 40px 32px 32px 32px;
  width: 100%;
  max-width: 450px;
  text-align: center;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  position: relative;
}

/* Icon Styling */
.icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.icon-circle {
  width: 60px;
  height: 60px;
  background: #f0f7ff; /* Soft blue tint */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.icon-circle::after {
  content: '';
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #f0f7ff;
  opacity: 0.4;
}
.icon-inner {
  color: #1969fe;
  font-size: 24px;
  font-weight: bold;
  border: 2px solid #1969fe;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* Typography */
h2 {
  font-size: 24px;
  color: #1e293b;
  margin: 0 0 12px 0;
  font-weight: 700;
}
.main-text {
  font-size: 16px;
  color: #64748b;
  margin-bottom: 8px;
}
.sub-text {
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 30px;
}

/* Action Buttons */
.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.single-btn {
  grid-template-columns: 1fr;
}

button {
  padding: 14px 20px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-outline {
  background: transparent;
  border: 1.5px solid #e2e8f0;
  color: #64748b;
}
.btn-outline:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-confirm,
.btn-primary {
  background: transparent;
  border: 1.5px solid #1969fe;
  color: #1969fe;
}
.btn-confirm:hover,
.btn-primary:hover {
  background: #1969fe;
  color: #ffffff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .modal-card {
    padding: 30px 20px 20px 20px;
  }
  .modal-actions {
    grid-template-columns: 1fr; /* Stack buttons on mobile */
  }
}
</style>
