<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { useToast } from 'vue-toastification'
import { PhRocket, PhX, PhArrowCircleUp } from '@phosphor-icons/vue'
import FormBuilder from './FormBuilder.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps({
  mode: { type: String, default: 'live' },
  eventId: { type: [String, null], default: null },
  organizerId: { type: String, default: '' },
  initialDraft: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'cancel'])

const toast = useToast()
const saving = ref(false)
const publishing = ref(false)
const builderRef = useTemplateRef('builderRef')
const bodyRef = useTemplateRef('bodyRef')
const showTop = ref(false)

const isLocal = computed(() => (props.mode === 'live' ? false : true))

function closeCancel() {
  if (!isLocal.value) {
    emit('cancel')
    return
  }
  const builder = builderRef.value
  const draft =
    builder && typeof builder.captureDraft === 'function' ? builder.captureDraft() : null
  if (draft) {
    emit('saved', draft)
  } else {
    emit('cancel')
  }
}

async function handleSave() {
  const builder = builderRef.value
  if (!builder || typeof builder.saveDraft !== 'function') {
    toast.error('Form builder is not ready yet.')
    return
  }
  saving.value = true
  try {
    const result = await (isLocal.value ? builder.saveAndPublish() : builder.saveDraft())
    if (!result) return
    emit('saved', typeof result === 'object' ? result : undefined)
  } catch (err) {
    toast.error('Could not save: ' + (err?.message || err))
  } finally {
    saving.value = false
  }
}

async function handlePublish() {
  const builder = builderRef.value
  if (!builder || typeof builder.publishLive !== 'function') {
    toast.error('Form builder is not ready yet.')
    return
  }
  if (!window.confirm('Publish a new version? Students will see this form immediately.')) {
    return
  }
  publishing.value = true
  try {
    const ok = await builder.publishLive()
    if (!ok) return
    emit('saved', undefined)
  } catch (err) {
    toast.error('Could not publish: ' + (err?.message || err))
  } finally {
    publishing.value = false
  }
}

function onSaved(draft) {
  emit('saved', draft)
}

function onCancelled() {
  emit('cancel')
}

function onKeydown(e) {
  if (e.key === 'Escape' && !saving.value && !publishing.value) closeCancel()
}

function onBodyScroll() {
  const el = bodyRef.value
  if (!el) return
  showTop.value = el.scrollTop > 200
}

function scrollToTop() {
  const el = bodyRef.value
  if (!el) return
  el.scrollTo({ top: 0, behavior: 'smooth' })
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
    <Transition name="fb-modal-fade" appear>
      <div class="fb-modal-overlay" @click.self="closeCancel">
        <Transition name="fb-modal-pop" appear>
          <div class="fb-modal" role="dialog" aria-modal="true" @click.stop>
            <header class="fb-modal__header">
              <h3>Registration Form</h3>
              <button
                type="button"
                class="fb-modal__close"
                :disabled="saving || publishing"
                @click="closeCancel"
              >
                <PhX :size="20" />
              </button>
            </header>

            <div ref="bodyRef" class="fb-modal__body" @scroll.passive="onBodyScroll">
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

            <Transition name="fb-top-fade">
              <button
                v-if="showTop"
                type="button"
                class="fb-modal__top"
                aria-label="Scroll to top"
                @click="scrollToTop"
              >
                <PhArrowCircleUp :size="24" />
              </button>
            </Transition>
            <footer class="fb-modal__footer">
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="saving || publishing"
                @click="closeCancel"
              >
                Cancel
              </BaseButton>

              <!-- <button
                v-if="!isLocal"
                type="button"
                class="fb-modal-btn fb-modal-btn--save"
                :disabled="saving || publishing"
                @click="handleSave"
              >
                <PhFloppyDisk :size="16" />
                {{ saving ? 'Saving...' : 'Save Draft' }}
              </button> -->

              <BaseButton
                v-if="!isLocal"
                variant="primary"
                size="sm"
                shadow
                :loading="publishing"
                :disabled="saving"
                @click="handlePublish"
              >
                <template #icon-left><PhRocket :size="16" /></template>
                Publish
              </BaseButton>

              <BaseButton
                v-else
                variant="primary"
                size="sm"
                shadow
                :loading="saving"
                :disabled="publishing"
                @click="handleSave"
              >
                <template #icon-left><PhRocket :size="16" /></template>
                Save & Publish
              </BaseButton>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
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

.fb-modal-fade-enter-active,
.fb-modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.fb-modal-fade-enter-from,
.fb-modal-fade-leave-to {
  opacity: 0;
}
.fb-modal-pop-enter-active {
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.fb-modal-pop-leave-active {
  transition:
    transform 0.16s ease,
    opacity 0.16s ease;
}
.fb-modal-pop-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
.fb-modal-pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

.fb-modal__top {
  position: absolute;
  right: 20px;
  bottom: 78px;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: #055dfa;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(5, 93, 250, 0.35);
  transition:
    background 0.15s,
    transform 0.15s;
  z-index: 5;
}
.fb-modal__top:hover {
  background: #0447c4;
  transform: translateY(-1px);
}
.fb-top-fade-enter-active,
.fb-top-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fb-top-fade-enter-from,
.fb-top-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
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
