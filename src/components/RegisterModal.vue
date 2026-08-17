<script setup>
import { ref, computed } from 'vue'
import { useStoreUserDetails } from '@/composables/useStoreUserDetails'
import { useUniventStore } from '@/stores/counter'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
  showModal: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'registered'])
const loading = ref(false)
const errorMsg = ref('')

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
  errorMsg.value = ''
  try {
    const { registerForEvent } = useStoreUserDetails()
    const result = await registerForEvent(props.event)
    if (result.success) {
      emit('registered', {
        event: props.event,
        status: result.status,
      })
      emit('close')
    } else {
      errorMsg.value = result.message || 'Registration could not be completed.'
    }
  } catch (err) {
    errorMsg.value = err?.message || 'An unexpected error occurred.'
  } finally {
    loading.value = false
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
          <BaseButton variant="primary-outline" size="lg" @click="openLogin"
            >Go to Login</BaseButton
          >
        </div>
      </div>

      <div class="modal-body" v-else>
        <h2>Register?</h2>
        <p class="main-text">You're about to register for this event.</p>
        <p class="sub-text">
          We'll share your name and email with the organizer so they can reserve your spot.
        </p>

        <div v-if="errorMsg" class="error-text">
          {{ errorMsg }}
        </div>

        <div class="modal-actions">
          <BaseButton variant="outline" size="lg" :disabled="loading" @click="cancel"
            >Cancel</BaseButton
          >
          <BaseButton
            variant="primary-outline"
            size="lg"
            :loading="loading"
            @click="agree"
          >
            Yes, I Agree
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.icon-circle {
  width: 60px;
  height: 60px;
  background: #f0f7ff;
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

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.single-btn {
  grid-template-columns: 1fr;
}

.error-text {
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 16px;
  text-align: center;
}

@media (max-width: 480px) {
  .modal-card {
    padding: 30px 20px 20px 20px;
  }
  .modal-actions {
    grid-template-columns: 1fr;
  }
}
</style>
