<script setup>
import { ref, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { useToast } from 'vue-toastification'
import { PhFloppyDisk, PhX } from '@phosphor-icons/vue'
import FormBuilder from './FormBuilder.vue'

defineProps({
  mode: { type: String, default: 'live' },
  eventId: { type: [String, null], default: null },
  organizerId: { type: String, default: '' },
  initialDraft: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'cancel'])

const toast = useToast()
const saving = ref(false)
const builderRef = useTemplateRef('builderRef')

function closeCancel() {
  emit('cancel')
}

async function handleSave() {
  const builder = builderRef.value
  if (!builder || typeof builder.saveDraft !== 'function') {
    toast.error('Form builder is not ready yet.')
    return
  }
  saving.value = true
  try {
    const result = await builder.saveDraft()
    if (!result) return
    // Local mode returns the draft object; live mode returns `true` (state
    // already persisted to Supabase). Forward the draft only when present so
    // AddEvent's onFormSaved stores it / mirrors it to localStorage.
    emit('saved', typeof result === 'object' ? result : undefined)
  } catch (err) {
    toast.error('Could not save: ' + (err?.message || err))
  } finally {
    saving.value = false
  }
}

function onSaved(draft) {
  // FormBuilder may still emit `saved` from its (now hidden) action buttons;
  // forward the payload if any. Primary path is handleSave() above.
  emit('saved', draft)
}

function onCancelled() {
  emit('cancel')
}

function onKeydown(e) {
  if (e.key === 'Escape' && !saving.value) closeCancel()
}

let prevOverflow = ''
onMounted(async () => {
  await nextTick()
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.body.style.overflow = prevOverflow || ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="fb-modal-overlay" @click.self="closeCancel">
      <div class="fb-modal" role="dialog" aria-modal="true" @click.stop>
        <header class="fb-modal__header">
          <h3>Registration Form</h3>
          <button type="button" class="fb-modal__close" :disabled="saving" @click="closeCancel">
            <PhX :size="20" />
          </button>
        </header>

        <div class="fb-modal__body">
          <FormBuilder
            ref="builderRef"
            :mode="mode"
            :event-id="eventId"
            :organizer-id="organizerId"
            :initial-draft="initialDraft"
            :hide-actions="true"
            @saved="onSaved"
            @cancelled="onCancelled"
          />
        </div>

        <footer class="fb-modal__footer">
          <button type="button" class="fb-modal-btn fb-modal-btn--cancel" :disabled="saving" @click="closeCancel">
            Cancel
          </button>
          <button type="button" class="fb-modal-btn fb-modal-btn--save" :disabled="saving" @click="handleSave">
            <PhFloppyDisk :size="16" />
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fb-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.fb-modal {
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  background: #fff;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.fb-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}
.fb-modal__header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1e293b;
}
.fb-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.fb-modal__close:hover:not(:disabled) {
  background: #f1f5f9;
  color: #1e293b;
}
.fb-modal__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fb-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scrollbar-width: thin;
}
.fb-modal__body::-webkit-scrollbar {
  width: 8px;
}
.fb-modal__body::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 999px;
}

.fb-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #f1f5f9;
  background: #fff;
}
.fb-modal-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.fb-modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.fb-modal-btn--cancel {
  background: #f1f5f9;
  color: #475569;
  border-color: #e2e8f0;
}
.fb-modal-btn--cancel:hover:not(:disabled) {
  background: #e2e8f0;
}
.fb-modal-btn--save {
  background: #055dfa;
  color: #fff;
  box-shadow: 0 4px 6px -1px rgba(5, 93, 250, 0.3);
}
.fb-modal-btn--save:hover:not(:disabled) {
  background: #0447c4;
}

@media (max-width: 640px) {
  .fb-modal-overlay {
    padding: 0;
  }
  .fb-modal {
    max-width: 100%;
    max-height: 100vh;
    height: 100vh;
    border-radius: 0;
  }
  .fb-modal__footer {
    display: flex;
    gap: 10px;
  }
  .fb-modal-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>