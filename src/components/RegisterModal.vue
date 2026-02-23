<template>
  <div v-if="showModal" class="register-modal">
    <div class="modal-content">
      <div v-if="!isLoggedIn">
        <p>You must be logged in to register for an event.</p>
        <button @click="openLogin">Login</button>
      </div>
      <div v-else>
        <p>
          Do you consent to sharing your profile details (name, email, phone) with the event organizer?
        </p>
        <div class="modal-actions">
          <button @click="cancel">Cancel</button>
          <button @click="agree" :disabled="loading">{{ loading ? 'Processing...' : 'Yes, I Agree' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStoreUserDetails } from '@/composables/useStoreUserDetails'
import { useUniventStore } from '@/stores/counter'

const props = defineProps({
 event: {
    type: Object,
    required: true,
  },
  local_Events : ref([]),
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
  const { addUserToEvent } = await useStoreUserDetails()
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

<style scoped>
.register-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  min-width: 320px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.15);
}
.modal-actions {
  display: flex;
  gap: 16px;
  margin-top: 24px;
}
button {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  background: #1969fe;
  color: #fff;
  font-weight: 600;
  cursor: pointer;

}
button:first-child {
  background: #aaa;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
