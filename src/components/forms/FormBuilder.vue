<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import {
  PhPlus,
  PhEye,
  PhPencilSimple,
  PhFloppyDisk,
  PhRocket,
  PhWarning,
  PhListChecks,
  PhClockClockwise,
} from '@phosphor-icons/vue'
import FieldEditor from './FieldEditor.vue'
import {
  FIELD_TYPES,
  makeField,
  normalizeFields,
  validateFields,
  useRegistrationForm,
} from '@/composables/useRegistrationForm'

const props = defineProps({
  // 'live' writes straight to Supabase against `eventId` (existing event).
  // 'local' keeps everything in-memory and emits the draft back to the parent
  // so it can be persisted only after the event is created. See AddEvent.vue.
  mode: { type: String, default: 'live', validator: (v) => v === 'live' || v === 'local' },
  // Only required in live mode (must reference an existing events row). In
  // local mode this is null and ignored — no DB rows are touched until the
  // parent triggers create-draft/save-draft/publish after event creation.
  eventId: { type: [String, null], default: null },
  organizerId: { type: String, default: '' },
  // Local-mode seed: { title, description, fields, status }. Lets the organizer
  // re-open the builder and keep their in-progress work. Ignored in live mode.
  initialDraft: { type: Object, default: null },
})

// Parent listens for these only in local mode (live mode persists itself).
// `saved` payload shape: { title, description, fields, status }
const emit = defineEmits(['saved', 'cancelled'])

const isLocal = computed(() => props.mode === 'local')

const toast = useToast()
const { loadForm, createFormDraft, saveDraft, publish, setStatus, listVersions } =
  useRegistrationForm()

const loading = ref(true)
const saving = ref(false)
const publishing = ref(false)
const formId = ref(null)
const formStatus = ref('draft') // draft | published | closed | archived
const publishedVersionId = ref(null)
// Full published snapshot (the immutable version students submit against).
// `null` when the form has never been published. Holds { id, version, fields }.
const publishedSnapshot = ref(null)
// History of all published versions (newest first) for the version-history panel.
const versions = ref([])
const title = ref('Registration Form')
const description = ref('')
const fields = ref([])
const activeTab = ref('editor') // editor | preview
// Preview source toggle: 'published' renders the immutable snapshot (what
// students actually see); 'draft' renders the editable fields_draft. Only
// matters when a published snapshot exists.
const previewSource = ref('published')
const versionsOpen = ref(false)
const lastSavedFields = ref([]) // for dirty detection
// Local-mode only: the saved draft's intended status ('draft' | 'published').
// In live mode the real status lives in `formStatus` and is DB-driven.
const intendedStatus = ref('draft')

const hasForm = computed(() => formId.value !== null)
const isPublished = computed(() => formStatus.value === 'published')
const isClosed = computed(() => formStatus.value === 'closed' || formStatus.value === 'archived')

const isDirty = computed(() => {
  const a = JSON.stringify(normalizeFields(fields.value))
  const b = JSON.stringify(normalizeFields(lastSavedFields.value))
  return a !== b
})

const localErrors = computed(() => validateFields(fields.value))
const canPublish = computed(() => fields.value.length > 0 && localErrors.value.length === 0)

// Whether the draft diverges from the published snapshot. Drives the
// "Republish to push changes to students" hint.
const draftDiffersFromPublished = computed(() => {
  if (!publishedSnapshot.value || !Array.isArray(publishedSnapshot.value.fields)) return false
  const a = JSON.stringify(normalizeFields(fields.value))
  const b = JSON.stringify(normalizeFields(publishedSnapshot.value.fields))
  return a !== b
})

// The field set the preview should render, honoring `previewSource`. When not
// yet published, falls back to the draft.
const previewFields = computed(() => {
  if (
    previewSource.value === 'published' &&
    publishedSnapshot.value &&
    Array.isArray(publishedSnapshot.value.fields) &&
    publishedSnapshot.value.fields.length > 0
  ) {
    return publishedSnapshot.value.fields
  }
  return fields.value
})

const previewTitle = computed(() => title.value || 'Registration Form')
const previewDescription = computed(() => description.value)

onMounted(init)

async function init() {
  loading.value = true
  if (isLocal.value) {
    // Local mode: no Supabase reads/writes. The builder works entirely on
    // in-memory refs and emits the draft back to AddEvent when the organizer
    // clicks Save. Nothing is persisted until the event is created.
    formId.value = null
    formStatus.value = 'draft'
    publishedSnapshot.value = null
    publishedVersionId.value = null
    versions.value = []
    previewSource.value = 'draft'
    if (props.initialDraft) {
      title.value = props.initialDraft.title || 'Registration Form'
      description.value = props.initialDraft.description || ''
      fields.value = Array.isArray(props.initialDraft.fields)
        ? JSON.parse(JSON.stringify(props.initialDraft.fields))
        : []
      intendedStatus.value = props.initialDraft.status === 'published' ? 'published' : 'draft'
    } else {
      title.value = 'Registration Form'
      description.value = ''
      fields.value = []
      intendedStatus.value = 'draft'
    }
    lastSavedFields.value = normalizeFields(fields.value)
    loading.value = false
    return
  }
  try {
    const form = await loadForm(props.eventId)
    if (form) {
      formId.value = form.id
      formStatus.value = form.status
      title.value = form.title || 'Registration Form'
      description.value = form.description || ''
      fields.value = Array.isArray(form.fields_draft) ? [...form.fields_draft] : []
      lastSavedFields.value = JSON.parse(JSON.stringify(fields.value))
      publishedVersionId.value = form.current_version_id
      // `loadForm` joins current_version:registration_form_versions(*), so this
      // already carries the full immutable field set. Use it as the published
      // preview source (what students see right now).
      publishedSnapshot.value = form.current_version || null
      // Make sure the preview shows the live snapshot when one exists.
      previewSource.value = form.current_version ? 'published' : 'draft'
      // Load version history in the background (non-blocking).
      loadVersionHistory()
    } else {
      // Leave form-less until the organizer clicks "Add Registration Form".
      formId.value = null
      formStatus.value = 'draft'
      publishedSnapshot.value = null
      versions.value = []
      previewSource.value = 'draft'
    }
  } catch (err) {
    toast.error('Could not load registration form: ' + (err.message || err))
  } finally {
    loading.value = false
  }
}

async function loadVersionHistory() {
  if (!formId.value) {
    versions.value = []
    return
  }
  const r = await listVersions(formId.value)
  if (r.success) versions.value = r.versions
  else versions.value = []
}

function addField(type) {
  const position = fields.value.length + 1
  const f = makeField(type, {
    label: `New ${FIELD_TYPES.find((t) => t.type === type)?.label || 'Field'}`,
    position,
  })
  fields.value = [...fields.value, f]
}

function updateField(index, next) {
  const arr = [...fields.value]
  arr[index] = next
  fields.value = arr
}

function removeField(index) {
  fields.value = fields.value.filter((_, i) => i !== index)
}

function moveUp(index) {
  if (index === 0) return
  const arr = [...fields.value]
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  fields.value = arr
}

function moveDown(index) {
  if (index === fields.value.length - 1) return
  const arr = [...fields.value]
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  fields.value = arr
}

// Re-normalize positions whenever the array size/order changes.
watch(
  () => fields.value.map((f) => f.id).join('|'),
  () => {
    fields.value = fields.value.map((f, i) => ({ ...f, position: i + 1 }))
  },
)

async function ensureFormCreated() {
  if (formId.value) return true
  const r = await createFormDraft({
    eventId: props.eventId,
    organizerId: props.organizerId,
    title: title.value,
    description: description.value,
  })
  if (!r.success) {
    toast.error('Could not create form: ' + r.error)
    return false
  }
  formId.value = r.form.id
  formStatus.value = r.form.status
  return true
}

async function handleSaveDraft() {
  if (!fields.value.length) {
    toast.error('Add at least one field before saving.')
    return
  }
  const ok = await ensureFormCreated()
  if (!ok) return
  saving.value = true
  try {
    const r = await saveDraft(formId.value, {
      title: title.value,
      description: description.value,
      fields_draft: fields.value,
    })
    if (!r.success) {
      toast.error('Failed to save draft: ' + r.error)
      return
    }
    lastSavedFields.value = normalizeFields(fields.value)
    toast.success('Draft saved.')
  } finally {
    saving.value = false
  }
}

async function handlePublish() {
  if (!canPublish.value) {
    toast.error(localErrors.value.join(' '))
    return
  }
  const ok = await ensureFormCreated()
  if (!ok) return
  // Persist the draft first so the editor's current state is recoverable, then
  // snapshot-and-publish via the RPC.
  saving.value = true
  const sd = await saveDraft(formId.value, {
    title: title.value,
    description: description.value,
    fields_draft: fields.value,
  })
  saving.value = false
  if (!sd.success) {
    toast.error('Failed to save before publishing: ' + sd.error)
    return
  }
  publishing.value = true
  try {
    const r = await publish(formId.value, fields.value)
    if (!r.success) {
      toast.error('Failed to publish: ' + r.error)
      return
    }
    publishedVersionId.value = r.versionId
    formStatus.value = 'published'
    lastSavedFields.value = normalizeFields(fields.value)
    // Reload the full published snapshot (with fields) so the Preview tab
    // immediately renders exactly what students will see after this publish.
    await reloadPublished()
    toast.success(`Form published (version ${r.version}). Students can now register.`)
  } finally {
    publishing.value = false
  }
}

/**
 * reloadPublished()
 *   Re-fetch the registration_forms row (with its current_version join) and the
 *   version history so `publishedSnapshot`, `publishedVersionId`, and
 *   `versions` reflect the DB's current state. Called after publish/close/
 *   reopen. Falls back gracefully if the lookup fails.
 */
async function reloadPublished() {
  try {
    const form = await loadForm(props.eventId)
    if (form) {
      formStatus.value = form.status
      publishedVersionId.value = form.current_version_id
      publishedSnapshot.value = form.current_version || null
      // The RPC `publish_registration_form` mirrors the published fields into
      // fields_draft, so on a fresh publish the draft equals the snapshot; keep
      // lastSavedFields in sync so isDirty resets correctly.
      if (Array.isArray(form.fields_draft) && form.fields_draft.length) {
        lastSavedFields.value = normalizeFields(form.fields_draft)
      }
      if (publishedSnapshot.value) previewSource.value = 'published'
    }
  } catch (err) {
    // Non-fatal: preview will just keep showing the prior snapshot.
    console.warn('reloadPublished failed:', err)
  }
  await loadVersionHistory()
}

async function handleClose() {
  if (!formId.value) return
  if (!confirm('Close registration for this event? Students will no longer be able to submit.')) {
    return
  }
  const r = await setStatus(formId.value, 'closed')
  if (!r.success) {
    toast.error('Failed to close: ' + r.error)
    return
  }
  formStatus.value = 'closed'
  await reloadPublished()
  toast.success('Registration closed.')
}

async function handleReopen() {
  if (!formId.value) return
  const r = await setStatus(formId.value, 'published')
  if (!r.success) {
    toast.error('Failed to reopen: ' + r.error)
    return
  }
  formStatus.value = 'published'
  await reloadPublished()
  toast.success('Registration reopened.')
}

// ---------------------------------------------------------------------------
// Local-mode handlers. No DB writes — the draft is handed back to AddEvent
// via `emit('saved', draft)`. AddEvent persists it (createFormDraft/saveDraft
// /publish) only after the event row exists, so we never create an orphan
// registration_forms row. See AddEvent.handleSaveEvent for the persist path.
// ---------------------------------------------------------------------------

function handleLocalSaveDraft() {
  if (!fields.value.length) {
    toast.error('Add at least one field before saving.')
    return
  }
  const errs = validateFields(fields.value)
  if (errs.length) {
    toast.error(errs.join(' '))
    return
  }
  emit('saved', {
    title: title.value || 'Registration Form',
    description: description.value || '',
    fields: normalizeFields(fields.value),
    status: 'draft',
  })
  toast.success('Custom form saved. It will be attached when you create the event.')
}

function handleLocalSavePublish() {
  if (!canPublish.value) {
    toast.error(localErrors.value.join(' ') || 'Add at least one valid field to publish.')
    return
  }
  emit('saved', {
    title: title.value || 'Registration Form',
    description: description.value || '',
    fields: normalizeFields(fields.value),
    status: 'published',
  })
  toast.success('Custom form saved. It will be published when you create the event.')
}

function handleLocalCancel() {
  // Per AddEvent's contract, cancel keeps any existing pending draft intact.
  // If the organizer never saved (no draft), AddEvent has nothing to keep.
  emit('cancelled')
}
</script>

<template>
  <div class="form-builder" v-if="!loading">
    <!-- Toolbar / status -->
    <div class="fb-header">
      <div class="fb-header__title">
        <PhListChecks :size="20" />
        <h3>Custom Registration Form</h3>
      </div>
      <div class="fb-header__status">
        <span class="status-badge" :class="`status-badge--${formStatus}`">{{ formStatus }}</span>
        <span v-if="publishedVersion" class="version-info">v{{ publishedVersion.version }}</span>
      </div>
    </div>

    <!-- Local-mode banner: nothing is written to Supabase until Create Event. -->
    <div v-if="isLocal" class="fb-local-banner">
      You're designing a form for an event that hasn't been saved yet. Your work stays in this
      page's memory and is attached to the event when you click <strong>Create Event</strong>.
    </div>

    <!-- Empty state: organizer hasn't opted in yet -->
    <div v-if="!hasForm && fields.length === 0" class="fb-empty">
      <p>
        No custom form yet. Add a question below to start building one — students will see it
        instead of the simple confirmation modal.
      </p>
      <p class="fb-empty__hint">
        If you skip this, the event keeps using UniVent's default
        <em>"Register on UniVent"</em> flow (no changes).
      </p>
    </div>

    <!-- Title + description -->
    <div class="fb-meta card" v-if="hasForm || fields.length > 0">
      <div class="field-group">
        <label>Form Title</label>
        <input v-model="title" type="text" placeholder="e.g. Registration Form" />
      </div>
      <div class="field-group">
        <label>
          Description
          <span class="optional">shown above the form</span>
        </label>
        <textarea
          v-model="description"
          rows="2"
          placeholder="Tell students what to expect..."
        ></textarea>
      </div>
    </div>

    <!-- Tabs -->
    <div class="fb-tabs" v-if="hasForm || fields.length > 0">
      <button
        type="button"
        class="fb-tab"
        :class="{ 'fb-tab--active': activeTab === 'editor' }"
        @click="activeTab = 'editor'"
      >
        <PhPencilSimple :size="16" /> Editor
      </button>
      <button
        type="button"
        class="fb-tab"
        :class="{ 'fb-tab--active': activeTab === 'preview' }"
        @click="activeTab = 'preview'"
      >
        <PhEye :size="16" /> Preview
      </button>
    </div>

    <!-- Editor -->
    <!-- && (hasForm || fields.length > 0) -->
    <div v-if="activeTab === 'editor'">
      <!-- Add field palette -->
      <div class="fb-palette">
        <div class="fb-palette__label"><PhPlus :size="16" /> Add a field</div>
        <div class="fb-palette__grid">
          <button
            v-for="t in FIELD_TYPES"
            :key="t.type"
            type="button"
            class="fb-palette__item"
            @click="addField(t.type)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- Field list -->
      <div class="fb-fields" v-if="fields.length > 0">
        <FieldEditor
          v-for="(f, i) in fields"
          :key="f.id"
          :field="f"
          :index="i"
          :total="fields.length"
          @update:field="updateField(i, $event)"
          @remove="removeField(i)"
          @move-up="moveUp(i)"
          @move-down="moveDown(i)"
        />
      </div>
      <div v-else class="fb-fields-empty">
        No fields yet. Use the palette above to add your first one.
      </div>

      <!-- Validation errors -->
      <div v-if="localErrors.length" class="fb-errors">
        <PhWarning :size="16" />
        <ul>
          <li v-for="(e, i) in localErrors" :key="i">{{ e }}</li>
        </ul>
      </div>

      <!-- Draft divergence hint (editor side) -->
      <div v-if="draftDiffersFromPublished" class="fb-divergence">
        <PhClockClockwise :size="16" />
        <span>
          Your draft differs from the published form (v{{ publishedSnapshot?.version }}). Existing
          student answers stay attached to the version they submitted against until you
          <strong>Republish</strong>.
        </span>
      </div>
    </div>

    <!-- Preview -->
    <div v-if="activeTab === 'preview' && (hasForm || fields.length > 0)" class="fb-preview-wrap">
      <!-- Preview source control: what students see (published) vs current draft -->
      <div
        v-if="publishedSnapshot && Array.isArray(publishedSnapshot.fields)"
        class="fb-preview-source"
      >
        <button
          type="button"
          class="fb-src-btn"
          :class="{ 'fb-src-btn--active': previewSource === 'published' }"
          @click="previewSource = 'published'"
        >
          <PhEye :size="15" /> What students see
          <span v-if="publishedSnapshot" class="fb-src-btn__meta"
            >v{{ publishedSnapshot.version }}</span
          >
        </button>
        <button
          type="button"
          class="fb-src-btn"
          :class="{ 'fb-src-btn--active': previewSource === 'draft' }"
          @click="previewSource = 'draft'"
        >
          <PhPencilSimple :size="15" /> Your draft
          <span v-if="draftDiffersFromPublished" class="fb-src-btn__meta fb-src-btn__meta--warn"
            >edited</span
          >
        </button>
      </div>

      <!-- Status banner -->
      <div class="fb-preview-banner" :class="`fb-preview-banner--${formStatus}`">
        <template v-if="formStatus === 'published' && previewSource === 'published'">
          This is the published form students see right now. They can submit against these fields.
        </template>
        <template
          v-else-if="
            formStatus === 'published' && previewSource === 'draft' && draftDiffersFromPublished
          "
        >
          Your draft has changes. Click <strong>Republish</strong> to push them to students.
          Students who already submitted keep their original answers against the previous version.
        </template>
        <template
          v-else-if="
            formStatus === 'published' && previewSource === 'draft' && !draftDiffersFromPublished
          "
        >
          Your draft matches the published form. Nothing to republish.
        </template>
        <template v-else-if="formStatus === 'closed'">
          Registration is closed. <strong>Students cannot submit</strong>, but their previous
          responses are preserved in the published v{{ publishedSnapshot?.version }} snapshot.
        </template>
        <template v-else-if="formStatus === 'archived'">
          This form is archived. It is no longer visible to students.
        </template>
        <template v-else-if="isLocal">
          This is a preview of your in-progress form. <strong>Nothing is live yet</strong> — click
          <strong>Save as Draft</strong> or <strong>Save &amp; Publish</strong>, then create the
          event to attach it.
        </template>
        <template v-else>
          This is a preview of your draft. <strong>Not yet visible to students</strong> — click
          <strong>Publish</strong> to make it live.
        </template>
      </div>

      <div class="fb-preview card">
        <h3 class="fb-preview__title">{{ previewTitle }}</h3>
        <p v-if="previewDescription" class="fb-preview__desc">{{ previewDescription }}</p>
        <div v-if="previewFields.length === 0" class="fb-preview__empty">
          No fields to preview yet.
        </div>
        <form v-else @submit.prevent class="fb-preview__form">
          <div v-for="f in previewFields" :key="f.id || f.key" class="fb-preview__field">
            <label>
              {{ f.label || '(no label)' }}
              <span v-if="f.required" class="req">*</span>
            </label>
            <p v-if="f.description" class="fb-preview__help">{{ f.description }}</p>

            <input v-if="f.type === 'text'" type="text" :placeholder="f.placeholder" disabled />
            <input
              v-else-if="f.type === 'email'"
              type="email"
              :placeholder="f.placeholder"
              disabled
            />
            <input
              v-else-if="f.type === 'phone'"
              type="tel"
              :placeholder="f.placeholder"
              disabled
            />
            <input
              v-else-if="f.type === 'number'"
              type="number"
              :placeholder="f.placeholder"
              disabled
            />
            <input v-else-if="f.type === 'date'" type="date" disabled />
            <textarea
              v-else-if="f.type === 'textarea'"
              rows="3"
              :placeholder="f.placeholder"
              disabled
            ></textarea>
            <select v-else-if="f.type === 'select'" disabled>
              <option v-for="(o, i) in f.options || []" :key="i">{{ o }}</option>
            </select>
            <div v-else-if="f.type === 'radio'" class="fb-preview__choices">
              <label v-for="(o, i) in f.options || []" :key="i" class="radio-item">
                <input type="radio" disabled />
                {{ o }}
              </label>
            </div>
            <div v-else-if="f.type === 'checkbox'" class="fb-preview__choices">
              <label v-for="(o, i) in f.options || []" :key="i" class="checkbox-item">
                <input type="checkbox" disabled />
                {{ o }}
              </label>
            </div>
            <div v-else-if="f.type === 'file' || f.type === 'image'" class="fb-preview__upload">
              <span>Click to upload ({{ f.type }})</span>
            </div>
          </div>

          <div class="fb-preview__submit">
            <button type="button" class="fb-preview__submit-btn" disabled>
              Submit Registration
            </button>
            <small class="fb-preview__submit-hint">
              (this is a preview — submitting is how students register)
            </small>
          </div>
        </form>
      </div>
    </div>

    <!-- Actions -->
    <div class="fb-actions" v-if="hasForm || fields.length > 0">
      <!-- Local mode: hand the draft back to AddEvent. No DB writes here. -->
      <template v-if="isLocal">
        <button
          type="button"
          class="fb-btn fb-btn--secondary"
          :disabled="!fields.length || localErrors.length > 0"
          @click="handleLocalSaveDraft"
        >
          <PhFloppyDisk :size="16" /> Save as Draft
        </button>
        <button
          type="button"
          class="fb-btn fb-btn--primary"
          :disabled="!canPublish"
          @click="handleLocalSavePublish"
        >
          <PhRocket :size="16" /> Save &amp; Publish
        </button>
        <button type="button" class="fb-btn fb-btn--ghost" @click="handleLocalCancel">
          Cancel
        </button>
      </template>

      <!-- Live mode: persist directly against the existing event. -->
      <template v-else>
        <button
          type="button"
          class="fb-btn fb-btn--secondary"
          :disabled="saving || publishing || !isDirty"
          @click="handleSaveDraft"
        >
          <PhFloppyDisk :size="16" /> {{ saving ? 'Saving...' : 'Save Draft' }}
        </button>
        <button
          type="button"
          class="fb-btn fb-btn--primary"
          :disabled="saving || publishing || !canPublish"
          @click="handlePublish"
        >
          <PhRocket :size="16" />
          {{ publishing ? 'Publishing...' : isPublished ? 'Republish' : 'Publish' }}
        </button>
        <button
          v-if="isPublished"
          type="button"
          class="fb-btn fb-btn--ghost"
          :disabled="saving || publishing"
          @click="handleClose"
        >
          Close Registration
        </button>
        <button
          v-else-if="isClosed"
          type="button"
          class="fb-btn fb-btn--ghost"
          :disabled="saving || publishing"
          @click="handleReopen"
        >
          Reopen Registration
        </button>
      </template>
    </div>

    <!-- Version history (organizer-only audit view) -->
    <div class="fb-versions" v-if="hasForm && versions.length > 0">
      <button type="button" class="fb-versions__toggle" @click="versionsOpen = !versionsOpen">
        <PhClockClockwise :size="16" />
        {{ versionsOpen ? 'Hide' : 'Show' }} version history ({{ versions.length }})
      </button>
      <div v-if="versionsOpen" class="fb-versions__list">
        <div
          v-for="v in versions"
          :key="v.id"
          class="fb-versions__item"
          :class="{ 'fb-versions__item--current': v.id === publishedVersionId }"
        >
          <div class="fb-versions__head">
            <span class="fb-versions__ver">v{{ v.version }}</span>
            <span v-if="v.id === publishedVersionId" class="fb-versions__current-badge"
              >current</span
            >
            <span class="fb-versions__time">
              {{ new Date(v.published_at).toLocaleString() }}
            </span>
            <span class="fb-versions__count">
              {{ Array.isArray(v.fields) ? v.fields.length : 0 }} fields
            </span>
          </div>
          <details class="fb-versions__fields">
            <summary>View fields</summary>
            <ul>
              <li v-for="(f, i) in v.fields || []" :key="f.id || i">
                <strong>{{ f.label || '(no label)' }}</strong>
                <span class="fb-versions__type"> · {{ f.type }}</span>
                <span v-if="f.required" class="fb-versions__req"> · required</span>
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="fb-loading">Loading form builder...</div>
</template>

<style scoped>
.form-builder {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 16px;
}
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.fb-header__title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fb-header__title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}
.fb-header__status {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-badge {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: 999px;
}
.status-badge--draft {
  color: #64748b;
  background: #f1f5f9;
}
.status-badge--published {
  color: #055dfa;
  background: rgba(5, 93, 250, 0.08);
}
.status-badge--closed,
.status-badge--archived {
  color: #dc2626;
  background: #fef2f2;
}
.version-info {
  font-size: 11px;
  color: #94a3b8;
}

.fb-empty {
  padding: 16px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #475569;
}
.fb-empty p {
  margin: 0 0 6px 0;
  font-size: 14px;
}
.fb-empty__hint {
  font-size: 12px !important;
  color: #94a3b8 !important;
}

.fb-meta .field-group label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}
input[type='text'],
input[type='number'],
input[type='email'],
input[type='tel'],
input[type='date'],
textarea,
select {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.2s;
}
input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: #055dfa;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(5, 93, 250, 0.1);
}
textarea {
  resize: none;
}
.optional {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 999px;
  margin-left: 6px;
}
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.fb-tabs {
  display: flex;
  gap: 8px;
}
.fb-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.fb-tab:hover {
  background: #f8fafc;
}
.fb-tab--active {
  background: #055dfa;
  color: #fff;
  border-color: #055dfa;
}

.fb-palette {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}
.fb-palette__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 10px;
}
.fb-palette__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.fb-palette__item {
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.fb-palette__item:hover {
  background: #055dfa;
  color: #fff;
  border-color: #055dfa;
}

.fb-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fb-fields-empty {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
}

.fb-errors {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #b91c1c;
}
.fb-errors ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

.fb-preview {
  background: #ffffff;
}
.fb-preview__title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}
.fb-preview__desc {
  margin: 0 0 16px 0;
  color: #64748b;
  font-size: 13px;
}
.fb-preview__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.fb-preview__field label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 4px;
}
.fb-preview__field .req {
  color: #dc2626;
  margin-left: 2px;
}
.fb-preview__help {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 6px 0;
}
.fb-preview__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.fb-preview__choices .radio-item,
.fb-preview__choices .checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #334155;
}
.fb-preview__upload {
  padding: 16px;
  border: 2px dashed #e2e8f0;
  border-radius: 10px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.fb-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 8px;
}
.fb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.fb-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.fb-btn--primary {
  background: #055dfa;
  color: #fff;
  box-shadow: 0 4px 6px -1px rgba(5, 93, 250, 0.3);
}
.fb-btn--primary:hover:not(:disabled) {
  background: #0447c4;
}
.fb-btn--secondary {
  background: #f1f5f9;
  color: #334155;
  border-color: #e2e8f0;
}
.fb-btn--secondary:hover:not(:disabled) {
  background: #e2e8f0;
}
.fb-btn--ghost {
  background: transparent;
  color: #dc2626;
  border-color: #fecaca;
}
.fb-btn--ghost:hover:not(:disabled) {
  background: #fef2f2;
}

.fb-loading {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
}

.fb-local-banner {
  padding: 10px 14px;
  background: rgba(5, 93, 250, 0.06);
  border: 1px solid rgba(5, 93, 250, 0.2);
  border-radius: 10px;
  color: #1e40af;
  font-size: 13px;
  line-height: 1.5;
}

/* ---- Stage 6C: preview source, banner, divergence, version history ---- */
.fb-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fb-preview-source {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.fb-src-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.fb-src-btn:hover {
  background: #f8fafc;
}
.fb-src-btn--active {
  background: #055dfa;
  color: #fff;
  border-color: #055dfa;
}
.fb-src-btn__meta {
  font-size: 11px;
  font-weight: 600;
  background: rgba(5, 93, 250, 0.12);
  color: #055dfa;
  padding: 1px 6px;
  border-radius: 999px;
}
.fb-src-btn--active .fb-src-btn__meta {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.fb-src-btn__meta--warn {
  background: #fef3c7;
  color: #b45309;
}
.fb-src-btn--active .fb-src-btn__meta--warn {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.fb-preview-banner {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid;
}
.fb-preview-banner--draft {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #475569;
}
.fb-preview-banner--published {
  background: rgba(5, 93, 250, 0.06);
  border-color: rgba(5, 93, 250, 0.2);
  color: #1e40af;
}
.fb-preview-banner--closed,
.fb-preview-banner--archived {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.fb-preview__empty {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.fb-preview__submit {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin-top: 4px;
}
.fb-preview__submit-btn {
  padding: 12px 24px;
  background: #055dfa;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: not-allowed;
  opacity: 0.7;
}
.fb-preview__submit-hint {
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
}

.fb-divergence {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 14px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.5;
}

.fb-versions {
  border-top: 1px solid #f1f5f9;
  padding-top: 14px;
}
.fb-versions__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
}
.fb-versions__toggle:hover {
  color: #055dfa;
}
.fb-versions__list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fb-versions__item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  background: #f8fafc;
}
.fb-versions__item--current {
  border-color: rgba(5, 93, 250, 0.4);
  background: rgba(5, 93, 250, 0.04);
}
.fb-versions__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.fb-versions__ver {
  font-weight: 600;
  color: #1e293b;
  font-size: 13px;
}
.fb-versions__current-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #055dfa;
  color: #fff;
  padding: 2px 6px;
  border-radius: 999px;
}
.fb-versions__time {
  font-size: 12px;
  color: #64748b;
}
.fb-versions__count {
  font-size: 12px;
  color: #94a3b8;
  margin-left: auto;
}
.fb-versions__fields {
  margin-top: 6px;
}
.fb-versions__fields summary {
  cursor: pointer;
  font-size: 12px;
  color: #055dfa;
  font-weight: 500;
}
.fb-versions__fields ul {
  margin: 6px 0 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: #475569;
}
.fb-versions__type,
.fb-versions__req {
  color: #94a3b8;
  font-weight: normal;
}

@media (max-width: 768px) {
  .fb-palette__grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  .fb-actions {
    flex-direction: column;
  }
  .fb-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
