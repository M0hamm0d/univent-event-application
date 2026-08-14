<script setup>
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'
import {
  PhX,
  PhCheckCircle,
  PhClockClockwise,
  PhWarning,
  PhSpinner,
  PhUploadSimple,
  PhFileText,
  PhTrash,
} from '@phosphor-icons/vue'
import { useUniventStore } from '@/stores/counter'
import { useFormSubmission } from '@/composables/useFormSubmission'
import { useFormUploads } from '@/composables/useFormUploads'
import { isChoiceField, isFileField } from '@/composables/useRegistrationForm'

const props = defineProps({
  event: { type: Object, required: true },
  showModal: { type: Boolean, default: false },
  editMode: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'registered'])

const univentStore = useUniventStore()
const isLoggedIn = computed(() => univentStore.isAuthenticated)

const { loading, submitForm, loadOwnResponse, updateForm, hasCustomForm } = useFormSubmission()
const { uploadFile, removeFiles, downloadFile } = useFormUploads()

// Per-field upload progress map (keyed by field.key) so multiple file fields
// can upload concurrently with independent spinners.
const uploadingField = ref({})
// Per-field fetch state for the "Download" link on already-uploaded files
// (edit-mode prefill shows the existing path as a download link).
const downloadingField = ref({})

// ---- form state ----
const formPayload = ref(null) // { title, description, form_version_id, fields }
const fields = computed(() => formPayload.value?.fields || [])
const answers = ref({}) // student answers keyed by field.key
const errors = ref({}) // per-field client-side validation errors
const fetchError = ref('')
const submitError = ref('')
const result = ref(null) // { status, position? }

// Edit-mode state.
const editExisting = ref(props.editMode)
const existingResponseMeta = ref(null)

watch(
  () => props.showModal,
  async (open) => {
    if (open) {
      result.value = null
      submitError.value = ''
      await loadForm()
    }
  },
  { immediate: true },
)

async function loadForm() {
  fetchError.value = ''
  const formData = await hasCustomForm(props.event.id)
  if (!formData) {
    // No published form — shouldn't happen since EventsCard only opens us when
    // one exists, but guard anyway so the student isn't stuck on a blank modal.
    fetchError.value = 'This event no longer has a registration form. Please close and try again.'
    return
  }
  formPayload.value = formData
  answers.value = {}
  errors.value = {}

  // If the student already submitted, the organizer/PRD wants them to be able
  // to "Edit Response". Probe in edit mode OR when we discover they already
  // submitted (so the modal reopens prefilled). This RPC returns null when the
  // student hasn't submitted yet, which is the normal new-submission path.
  const own = await loadOwnResponse(props.event.id)
  if (own) {
    editExisting.value = true
    existingResponseMeta.value = {
      submitted_at: own.submitted_at,
      updated_at: own.updated_at,
      form_version_id: own.form_version_id,
    }
    answers.value = { ...(own.answers || {}) }
  } else {
    editExisting.value = props.editMode
    existingResponseMeta.value = null
  }
}

function openLogin() {
  univentStore.loginModal = true
  emit('close')
}

// ---- helpers ----
function fieldLabel(f) {
  return f.label ? `${f.label}${f.required ? ' *' : ''}` : '(no label)'
}

function setAnswer(key, value) {
  answers.value = { ...answers.value, [key]: value }
  if (errors.value[key]) {
    errors.value = { ...errors.value, [key]: undefined }
    delete errors.value[key]
  }
}

function toggleCheckbox(key, option) {
  const current = Array.isArray(answers.value[key]) ? [...answers.value[key]] : []
  const idx = current.indexOf(option)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(option)
  setAnswer(key, current)
}

// ---- file / image uploads ----
async function handleFileChange(field, event) {
  const file = event.target.files?.[0]
  if (!file) return
  const key = field.key
  uploadingField.value = { ...uploadingField.value, [key]: true }
  // Keep a reference to the previously-set path so we can clean it up after a
  // successful replace (avoids orphaning the old file in storage).
  const previousPath = typeof answers.value[key] === 'string' ? answers.value[key] : null
  try {
    const r = await uploadFile(file, props.event.id, field.fileTypes || [])
    if (!r.success) {
      errors.value = { ...errors.value, [key]: r.error }
      return
    }
    setAnswer(key, r.path)
    if (previousPath && previousPath !== r.path) {
      // Best-effort cleanup of the replaced file; failure is non-fatal (the
      // orphan sweep is a later cleanup concern, not a UX blocker).
      await removeFiles([previousPath])
    }
  } finally {
    uploadingField.value = { ...uploadingField.value, [key]: false }
    // Reset the input so selecting the same file again re-triggers change.
    event.target.value = ''
  }
}

async function handleRemoveFile(field) {
  const key = field.key
  const previousPath = typeof answers.value[key] === 'string' ? answers.value[key] : null
  setAnswer(key, '')
  if (previousPath) {
    await removeFiles([previousPath])
  }
}

async function handleDownloadExisting(field) {
  const key = field.key
  const path = answers.value[key]
  if (!path) return
  downloadingField.value = { ...downloadingField.value, [key]: true }
  try {
    await downloadFile(path, props.event.id)
  } finally {
    downloadingField.value = { ...downloadingField.value, [key]: false }
  }
}

function fileNameFromPath(path) {
  if (!path || typeof path !== 'string') return ''
  return path.split('/').pop() || path
}

// ---- client-side validation (mirrors _validate_form_answers in the RPC) ----
function validate() {
  const next = {}
  fields.value.forEach((f) => {
    const key = f.key
    const v = answers.value[key]
    const required = !!f.required

    // Required / empty checks.
    const isEmpty =
      v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

    if (required && isEmpty) {
      next[key] = 'This field is required.'
      return
    }
    if (isEmpty) return

    // Type-specific sanity (the DB RPC is authoritative; this is UX feedback).
    if (f.type === 'email') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) {
        next[key] = 'Enter a valid email address.'
        return
      }
    }
    if (f.type === 'phone') {
      const digits = String(v).replace(/[-()\s]/g, '')
      if (!/^\d+$/.test(digits) || digits.length < 5) {
        next[key] = 'Enter a valid phone number.'
        return
      }
    }
    if (f.type === 'number') {
      const n = Number(v)
      if (Number.isNaN(n)) {
        next[key] = 'Enter a number.'
        return
      }
      if (f.validation?.min !== '' && f.validation?.min != null && n < Number(f.validation.min)) {
        next[key] = `Must be ≥ ${f.validation.min}.`
        return
      }
      if (f.validation?.max !== '' && f.validation?.max != null && n > Number(f.validation.max)) {
        next[key] = `Must be ≤ ${f.validation.max}.`
        return
      }
    }
    if (isChoiceField(f.type)) {
      const validOpts = (f.options || []).map(String)
      const picked = Array.isArray(v) ? v : [v]
      if (picked.some((p) => !validOpts.includes(String(p)))) {
        next[key] = 'Selected an invalid option.'
        return
      }
    }
  })
  errors.value = next
  return Object.keys(next).length === 0
}

// ---- submit ----
async function handleSubmit() {
  submitError.value = ''
  if (!validate()) {
    // Scroll to first error is left to the browser via :invalid styling.
    return
  }

  // Coerce answers to the JSON shapes the validator expects (e.g. number→str
  // is fine; the RPC re-coerces). Strip undefined keys.
  const cleaned = {}
  Object.keys(answers.value).forEach((k) => {
    const v = answers.value[k]
    if (v !== undefined && v !== null) cleaned[k] = v
  })

  if (editExisting.value) {
    // Edit path: update_form_response never runs capacity logic. Status/position
    // are unchanged. We don't emit 'registered' (no status change happened).
    const r = await updateForm(props.event.id, cleaned)
    if (r.success) {
      // Clean up orphaned uploads (files the student removed or replaced when
      // editing). The RPC computes the diff between old and new file answers
      // and returns the unreferenced storage paths; we delete them here so
      // storage doesn't accumulate abandoned files. Best-effort.
      const removed = Array.isArray(r.removedFilePaths) ? r.removedFilePaths : []
      if (removed.length) {
        await removeFiles(removed)
      }
      emit('close')
    } else {
      submitError.value = 'Could not update your response. Please try again.'
    }
    return
  }

  // New submission path: register_with_form (atomic capacity + form response).
  const r = await submitForm(props.event, formPayload.value?.form_version_id || null, cleaned)

  if (!r.success) {
    if (r.status === 'form_outdated') {
      // Refresh the form and let the student refill against the new version.
      await loadForm()
      submitError.value = 'The form was just updated. Please review your answers and submit again.'
    } else {
      submitError.value = 'Registration could not be completed. Please try again.'
    }
    return
  }

  // Show the result inline (per PRD: one flow — submitting IS the registration
  // attempt). Then bubble the status up so EventsCard's onRegisterClick can
  // update its registeredMap/waitingListMap (same handler as MODE 1).
  result.value = { status: r.status, position: r.position }
  emit('registered', { event: props.event, status: r.status })
}

function closeResult() {
  emit('close')
}

function handleOverlayClick() {
  // Don't close-on-overlay-click while submitting to avoid losing a registration
  // attempt the student has confirmed.
  if (loading.value) return
  emit('close')
}

// Date display helper for the event header.
const eventDateLabel = computed(() => {
  if (!props.event?.date) return ''
  if (props.event.date_not_fixed) return 'Date to be announced'
  const d = dayjs(props.event.date).format('dddd, MMMM D, YYYY')
  return props.event.time ? `${d}` : d
})
</script>

<template>
  <div v-if="showModal" class="rfm-overlay" @click="handleOverlayClick">
    <div class="rfm-card" @click.stop>
      <button type="button" class="rfm-close" @click="emit('close')" :disabled="loading">
        <PhX :size="18" />
      </button>

      <!-- Login gate (mirrors RegisterModal) -->
      <div v-if="!isLoggedIn" class="rfm-login">
        <h2>Login Required</h2>
        <p>You must be logged in to register for this event.</p>
        <button class="rfm-btn rfm-btn--primary" @click="openLogin">Go to Login</button>
      </div>

      <!-- Loading form -->
      <div v-else-if="!formPayload && !fetchError" class="rfm-state">
        <PhSpinner :size="22" class="rfm-spin" />
        <p>Loading registration form…</p>
      </div>

      <!-- No form / closed -->
      <div v-else-if="fetchError" class="rfm-state rfm-state--error">
        <PhWarning :size="22" />
        <p>{{ fetchError }}</p>
        <button class="rfm-btn rfm-btn--outline" @click="emit('close')">Close</button>
      </div>

      <!-- Result screen after submission -->
      <div v-else-if="result" class="rfm-result">
        <div
          class="rfm-result__icon"
          :class="
            result.status === 'registered' ? 'rfm-result__icon--ok' : 'rfm-result__icon--wait'
          "
        >
          <PhCheckCircle v-if="result.status === 'registered'" :size="48" />
          <PhClockClockwise v-else :size="48" />
        </div>
        <h2 v-if="result.status === 'registered'">You're registered!</h2>
        <h2 v-else>You're on the waiting list.</h2>
        <p v-if="result.status === 'registered'">
          We've saved your spot for <strong>{{ event.event_title }}</strong> and emailed you a
          confirmation.
        </p>
        <p v-else>
          The event is full. You're on the waiting list at
          <strong>position #{{ result.position }}</strong
          >. If a spot opens up you'll be promoted automatically and emailed — no need to fill the
          form again.
        </p>
        <button class="rfm-btn rfm-btn--primary" @click="closeResult">Done</button>
      </div>

      <!-- Form -->
      <div v-else class="rfm-body">
        <!-- Event header -->
        <div class="rfm-event-header">
          <h2>{{ event.event_title }}</h2>
          <p v-if="eventDateLabel" class="rfm-event-meta">{{ eventDateLabel }}</p>
          <p v-if="event.location" class="rfm-event-meta">{{ event.location }}</p>
        </div>

        <!-- Edit-mode banner -->
        <div v-if="editExisting" class="rfm-banner rfm-banner--edit">
          <PhClockClockwise :size="16" />
          <span>
            You've already submitted this form. Editing updates your answers
            <strong>without affecting your registration</strong> or waiting-list position.
          </span>
        </div>

        <h3 class="rfm-form-title">{{ formPayload.title || 'Registration Form' }}</h3>
        <p v-if="formPayload.description" class="rfm-form-desc">{{ formPayload.description }}</p>

        <form @submit.prevent="handleSubmit" class="rfm-form">
          <div v-for="f in fields" :key="f.id || f.key" class="rfm-field">
            <label class="rfm-field__label">{{ fieldLabel(f) }}</label>
            <p v-if="f.description" class="rfm-field__help">{{ f.description }}</p>

            <!-- Text -->
            <input
              v-if="f.type === 'text'"
              type="text"
              :value="answers[f.key] ?? ''"
              @input="setAnswer(f.key, $event.target.value)"
              :placeholder="f.placeholder || ''"
              :class="{ 'rfm-input--err': errors[f.key] }"
            />

            <!-- Long text -->
            <textarea
              v-else-if="f.type === 'textarea'"
              rows="3"
              :value="answers[f.key] ?? ''"
              @input="setAnswer(f.key, $event.target.value)"
              :placeholder="f.placeholder || ''"
              :class="{ 'rfm-input--err': errors[f.key] }"
            ></textarea>

            <!-- Email -->
            <input
              v-else-if="f.type === 'email'"
              type="email"
              :value="answers[f.key] ?? ''"
              @input="setAnswer(f.key, $event.target.value)"
              :placeholder="f.placeholder || ''"
              :class="{ 'rfm-input--err': errors[f.key] }"
            />

            <!-- Phone -->
            <input
              v-else-if="f.type === 'phone'"
              type="tel"
              :value="answers[f.key] ?? ''"
              @input="setAnswer(f.key, $event.target.value)"
              :placeholder="f.placeholder || ''"
              :class="{ 'rfm-input--err': errors[f.key] }"
            />

            <!-- Number -->
            <input
              v-else-if="f.type === 'number'"
              type="number"
              :value="answers[f.key] ?? ''"
              @input="setAnswer(f.key, $event.target.value)"
              :placeholder="f.placeholder || ''"
              :min="f.validation?.min"
              :max="f.validation?.max"
              :class="{ 'rfm-input--err': errors[f.key] }"
            />

            <!-- Date -->
            <input
              v-else-if="f.type === 'date'"
              type="date"
              :value="answers[f.key] ?? ''"
              @input="setAnswer(f.key, $event.target.value)"
              :min="f.validation?.min"
              :max="f.validation?.max"
              :class="{ 'rfm-input--err': errors[f.key] }"
            />

            <!-- Select -->
            <select
              v-else-if="f.type === 'select'"
              :value="answers[f.key] ?? ''"
              @change="setAnswer(f.key, $event.target.value)"
              :class="{ 'rfm-input--err': errors[f.key] }"
            >
              <option value="" disabled>Select…</option>
              <option v-for="(o, i) in f.options || []" :key="i" :value="o">{{ o }}</option>
            </select>

            <!-- Radio -->
            <div v-else-if="f.type === 'radio'" class="rfm-choices">
              <label v-for="(o, i) in f.options || []" :key="i" class="rfm-choice">
                <input
                  type="radio"
                  :name="f.key"
                  :value="o"
                  :checked="answers[f.key] === o"
                  @change="setAnswer(f.key, o)"
                />
                <span>{{ o }}</span>
              </label>
            </div>

            <!-- Checkbox -->
            <div v-else-if="f.type === 'checkbox'" class="rfm-choices">
              <label v-for="(o, i) in f.options || []" :key="i" class="rfm-choice">
                <input
                  type="checkbox"
                  :value="o"
                  :checked="(answers[f.key] || []).includes(o)"
                  @change="toggleCheckbox(f.key, o)"
                />
                <span>{{ o }}</span>
              </label>
            </div>

            <!-- File / image upload (Stage 6G: secure upload to private bucket) -->
            <div v-else-if="isFileField(f.type)" class="rfm-upload">
              <!-- Already-uploaded state: show filename + download + replace -->
              <div v-if="answers[f.key]" class="rfm-upload__done">
                <div class="rfm-upload__file">
                  <PhFileText :size="18" />
                  <button
                    type="button"
                    class="rfm-upload__filename"
                    :disabled="downloadingField[f.key]"
                    @click="handleDownloadExisting(f)"
                  >
                    {{ fileNameFromPath(answers[f.key]) }}
                  </button>
                </div>
                <div class="rfm-upload__file-actions">
                  <label
                    class="rfm-upload__replace"
                    :class="{ 'is-uploading': uploadingField[f.key] }"
                  >
                    <input
                      type="file"
                      :accept="
                        (f.fileTypes || []).join(',') ||
                        (f.type === 'image' ? 'image/*' : undefined)
                      "
                      :disabled="uploadingField[f.key] || loading"
                      @change="handleFileChange(f, $event)"
                      hidden
                    />
                    <PhUploadSimple :size="15" /> Replace
                  </label>
                  <button
                    type="button"
                    class="rfm-upload__remove"
                    :disabled="uploadingField[f.key] || loading"
                    @click="handleRemoveFile(f)"
                  >
                    <PhTrash :size="15" />
                  </button>
                </div>
              </div>

              <!-- Empty state: upload prompt -->
              <label
                v-else
                class="rfm-upload__zone"
                :class="{ 'is-uploading': uploadingField[f.key] }"
              >
                <input
                  type="file"
                  :accept="
                    (f.fileTypes || []).join(',') || (f.type === 'image' ? 'image/*' : undefined)
                  "
                  :disabled="uploadingField[f.key] || loading"
                  @change="handleFileChange(f, $event)"
                  hidden
                />
                <PhUploadSimple :size="18" />
                <span v-if="uploadingField[f.key]">Uploading…</span>
                <span v-else>
                  {{ f.type === 'image' ? 'Click to upload an image' : 'Click to upload a file' }}
                </span>
                <small class="rfm-upload__max">Max 10MB</small>
              </label>
            </div>

            <p v-if="errors[f.key]" class="rfm-field__err">{{ errors[f.key] }}</p>
          </div>

          <p v-if="submitError" class="rfm-submit-err">{{ submitError }}</p>

          <button type="submit" class="rfm-btn rfm-btn--primary rfm-submit" :disabled="loading">
            <span v-if="loading" class="rfm-spin-wrap"
              ><PhSpinner :size="18" class="rfm-spin" /> Processing…</span
            >
            <span v-else>{{ editExisting ? 'Save Updates' : 'Submit Registration' }}</span>
          </button>
          <p class="rfm-submit-hint">
            {{
              editExisting
                ? 'Saving updates your answers. Your registration or waitlist position is unchanged.'
                : 'Submitting this form is your registration attempt — no separate confirmation needed.'
            }}
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rfm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1000;
  padding: 24px 16px;
  overflow-y: auto;
}
.rfm-card {
  background: #ffffff;
  border-radius: 20px;
  width: 100%;
  max-width: 560px;
  padding: 28px 24px 24px 24px;
  position: relative;
  box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.25);
  margin: auto;
}
.rfm-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}
.rfm-close:hover {
  background: #e2e8f0;
  color: #1e293b;
}
.rfm-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- states ---- */
.rfm-state,
.rfm-login,
.rfm-result {
  text-align: center;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.rfm-state--error {
  color: #dc2626;
}
.rfm-spin {
  animation: rfm-spin 0.8s linear infinite;
}
@keyframes rfm-spin {
  to {
    transform: rotate(360deg);
  }
}

.rfm-login h2,
.rfm-result h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}
.rfm-login p,
.rfm-state p,
.rfm-result p {
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}

.rfm-result__icon {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rfm-result__icon--ok {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}
.rfm-result__icon--wait {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

/* ---- body / form ---- */
.rfm-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rfm-event-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px 0;
}
.rfm-event-meta {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.rfm-banner {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid;
}
.rfm-banner--edit {
  background: rgba(5, 93, 250, 0.06);
  border-color: rgba(5, 93, 250, 0.2);
  color: #1e40af;
}

.rfm-form-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}
.rfm-form-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}
.rfm-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rfm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rfm-field__label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.rfm-field__help {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}
.rfm-field__err {
  font-size: 12px;
  color: #dc2626;
  margin: 0;
}

input[type='text'],
input[type='email'],
input[type='tel'],
input[type='number'],
input[type='date'],
textarea,
select {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 10px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.15s;
}
input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: #055dfa;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(5, 93, 250, 0.12);
}
textarea {
  resize: none;
}
.rfm-input--err {
  border-color: #fecaca !important;
  background: #fef2f2 !important;
}

.rfm-choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rfm-choice {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
}
.rfm-choice input {
  width: 16px;
  height: 16px;
}

.rfm-upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rfm-upload__zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 14px;
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}
.rfm-upload__zone:hover {
  border-color: #055dfa;
  color: #055dfa;
  background: #f0f7ff;
}
.rfm-upload__zone.is-uploading {
  opacity: 0.7;
  cursor: progress;
}
.rfm-upload__max {
  font-size: 11px;
  color: #94a3b8;
}
.rfm-upload__done {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.rfm-upload__file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #1e293b;
  min-width: 0;
}
.rfm-upload__filename {
  background: none;
  border: none;
  padding: 0;
  color: #055dfa;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 240px;
}
.rfm-upload__filename:disabled {
  opacity: 0.6;
  cursor: progress;
}
.rfm-upload__file-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.rfm-upload__replace {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}
.rfm-upload__replace:hover {
  border-color: #055dfa;
  color: #055dfa;
}
.rfm-upload__replace.is-uploading {
  opacity: 0.6;
  cursor: progress;
}
.rfm-upload__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.15s;
}
.rfm-upload__remove:hover:not(:disabled) {
  background: #fef2f2;
}

.rfm-submit-err {
  font-size: 13px;
  color: #dc2626;
  text-align: center;
  margin: 0;
}
.rfm-submit {
  width: 100%;
  justify-content: center;
  padding: 14px;
  font-size: 15px;
}
.rfm-submit-hint {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

/* ---- buttons ---- */
.rfm-btn {
  padding: 12px 22px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.rfm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.rfm-btn--primary {
  background: #055dfa;
  color: #fff;
  border-color: #055dfa;
}
.rfm-btn--primary:hover:not(:disabled) {
  background: #0447c4;
  border-color: #0447c4;
}
.rfm-btn--outline {
  background: transparent;
  color: #475569;
  border-color: #e2e8f0;
}
.rfm-btn--outline:hover:not(:disabled) {
  background: #f8fafc;
}
.rfm-spin-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 480px) {
  .rfm-overlay {
    padding: 12px 8px;
  }
  .rfm-card {
    padding: 20px 16px 16px 16px;
    border-radius: 16px;
  }
}
</style>
