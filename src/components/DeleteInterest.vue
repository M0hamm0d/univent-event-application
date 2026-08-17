<script setup>
import { defineEmits } from 'vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps({
  event: { type: Object, required: true },
  actionType: { type: String, required: true },
  showModal: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'confirm'])
import { computed } from 'vue'

const mainText = computed(() => {
  if (props.actionType === 'deleteInterest') {
    return "You're about to remove this event from your interests."
  } else if (props.actionType === 'cancelRegistration') {
    return "You're about to cancel your registration for this event."
  } else if (props.actionType === 'leaveWaitlist') {
    return "You're about to leave the waiting list for this event."
  }
  return ''
})

const subText = computed(() => {
  if (props.actionType === 'deleteInterest') {
    return 'This will remove the event from your interests list.'
  } else if (props.actionType === 'cancelRegistration') {
    return "We'll cancel your registration and notify the organizer."
  } else if (props.actionType === 'leaveWaitlist') {
    return "If a spot opens up later, you won't be notified. You can re-register any time."
  }
  return ''
})

const heading = computed(() => {
  if (props.actionType === 'deleteInterest') return 'Remove Interest?'
  if (props.actionType === 'cancelRegistration') return 'Cancel Registration?'
  if (props.actionType === 'leaveWaitlist') return 'Leave Waiting List?'
  return ''
})

const confirmLabel = computed(() => {
  if (props.actionType === 'leaveWaitlist') return 'Yes, Leave'
  return 'Yes, I Agree'
})
function cancel() {
  emit('close')
}

async function agree() {
  emit('confirm', { event: props.event, actionType: props.actionType })
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

      <div class="modal-body">
        <h2>{{ heading }}</h2>

        <p class="main-text">{{ mainText }}</p>
        <p class="sub-text">{{ subText }}</p>

        <div class="modal-actions">
          <BaseButton variant="outline" size="lg" @click="cancel">Cancel</BaseButton>
          <BaseButton
            variant="primary-outline"
            size="lg"
            :loading="props.loading"
            @click="agree"
          >
            {{ confirmLabel }}
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

@media (max-width: 480px) {
  .modal-card {
    padding: 30px 20px 20px 20px;
  }
  .modal-actions {
    grid-template-columns: 1fr;
  }
}
</style>
