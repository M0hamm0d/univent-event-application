<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useToast } from 'vue-toastification'
import { useRegistrationForm } from '@/composables/useRegistrationForm'
import { useFormUploads } from '@/composables/useFormUploads'
import {
  PhX,
  PhPaperclip,
  PhCalendar,
  PhClock,
  PhListChecks,
  PhDownloadSimple,
} from '@phosphor-icons/vue'

const route = useRoute()
const router = useRouter()
const univentStore = useUniventStore()
const toast = useToast()
const { getActiveForm, getEventFormResponses } = useRegistrationForm()
const { downloadFile: fetchDownload } = useFormUploads()

const eventId = route.params.eventId
const event = ref(null)
const registered = ref([])
const waitlisted = ref([])
const loading = ref(true)
// Whether this event has a published custom form. Drives which RPC we use for
// attendee data and whether the "View Submission" affordance renders.
const hasCustomForm = ref(false)
// Full form-response payload from get_event_form_responses. Keyed by user_id
// so we can look up an attendee's submission when they click "View Submission".
const formResponsesByUser = ref({})
// The currently-open attendee in the submission detail drawer.
const selectedAttendee = ref(null)
// Tracks which file paths in the open drawer are currently being downloaded
// (keyed by `${user_id}::${path}`) so the link shows a spinner.
const downloadingFile = ref({})

const capacityDisplay = computed(() => {
  if (!event.value) return ''
  if (event.value.capacity === null || event.value.capacity === undefined) return 'Unlimited'
  return event.value.capacity
})

async function fetchAttendees() {
  loading.value = true
  try {
    // Pull basic event info for the header (guarded by RLS — only the owner).
    const { data: evData, error: evError } = await supabase
      .from('events')
      .select('id, event_title, date, capacity, requires_registration')
      .eq('id', eventId)
      .eq('user_id', univentStore.userProfile?.id)
      .maybeSingle()

    if (evError) {
      console.error(evError)
      toast.error('Failed to load event')
      return
    }
    if (!evData) {
      // Not the organizer or event doesn't exist.
      event.value = null
      return
    }
    event.value = evData

    if (!evData.requires_registration) {
      // No registration required — nothing to show.
      return
    }

    // Probe whether this event has a published custom form. If it does, we use
    // get_event_form_responses (richer: registration state + form answers +
    // version field snapshots). If not, we keep the existing get_event_attendees
    // path unchanged (MODE 1 events have zero behavior change).
    const activeForm = await getActiveForm(eventId)
    hasCustomForm.value = !!activeForm

    if (hasCustomForm.value) {
      await fetchFormResponses()
    } else {
      await fetchPlainAttendees()
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    toast.error('An unexpected error occurred')
  } finally {
    loading.value = false
  }
}

// MODE 1 path (no custom form) — unchanged from the original.
async function fetchPlainAttendees() {
  const { data, error } = await supabase.rpc('get_event_attendees', {
    p_event_id: eventId,
  })
  if (error) {
    console.error(error)
    toast.error(error.message || 'Failed to load attendees')
    return
  }
  const result = typeof data === 'string' ? JSON.parse(data) : data
  registered.value = result?.registered ?? []
  waitlisted.value = result?.waitlisted ?? []
}

// MODE 2 path (custom form) — fetch the richer payload that includes answers +
// version field snapshots, then split into registered/waitlisted arrays the
// template already knows how to render. Each attendee carries their form
// answers inline so "View Submission" needs no extra fetch.
async function fetchFormResponses() {
  const r = await getEventFormResponses(eventId)
  if (!r.success) {
    console.error(r.error)
    toast.error(r.error || 'Failed to load attendee submissions')
    // Fall back to plain attendees so the page still renders.
    await fetchPlainAttendees()
    return
  }
  const responses = r.data?.responses || []
  // Index by user_id for the drawer lookup.
  const byUser = {}
  responses.forEach((resp) => {
    byUser[resp.user_id] = resp
  })
  formResponsesByUser.value = byUser

  // Split into the same shape the template already uses, but enriched with a
  // `has_submission` flag and the answers reference. Keep cancelled students
  // out of the active lists (they show under a separate "Cancelled" section).
  registered.value = responses
    .filter((r) => r.registration_status === 'registered')
    .map((r) => ({
      user_id: r.user_id,
      user_name: r.user_name,
      user_email: r.user_email,
      profile_pics: r.profile_pics,
      registered_at: r.registered_at,
      has_submission: true,
    }))
  waitlisted.value = responses
    .filter((r) => r.registration_status === 'none' && r.waitlisted_at)
    .map((r, i) => ({
      user_id: r.user_id,
      user_name: r.user_name,
      user_email: r.user_email,
      profile_pics: r.profile_pics,
      created_at: r.waitlisted_at,
      waitlist_position: r.waitlist_position || i + 1,
      has_submission: true,
    }))
}

// Cancelled attendees (only relevant for form events — preserved for audit).
const cancelledAttendees = computed(() => {
  if (!hasCustomForm.value) return []
  return Object.values(formResponsesByUser.value).filter(
    (r) => r.registration_status === 'cancelled',
  )
})

function openSubmission(attendee) {
  const resp = formResponsesByUser.value[attendee.user_id]
  selectedAttendee.value = resp || null
}

function closeSubmission() {
  selectedAttendee.value = null
}

// Render an answer value nicely depending on field type.
function formatAnswer(field, value) {
  if (value === undefined || value === null || value === '') return '—'
  if (field?.type === 'checkbox' && Array.isArray(value)) {
    return value.join(', ')
  }
  if (field?.type === 'file' || field?.type === 'image') {
    // Show the filename; the drawer renders this as a clickable download link
    // that fetches a signed URL via the /api/form-file endpoint.
    return typeof value === 'string' ? value.split('/').pop() : '—'
  }
  return String(value)
}

// Organizer downloads an attendee's uploaded file. Uses the same
// /api/form-file endpoint as the student self-download; the endpoint verifies
// the requester is the organizer of the event AND that the path is referenced
// by a registration_form_responses row for this event before issuing a
// short-lived signed URL. Best-effort; failure shows a toast.
async function handleDownloadAttendeeFile(response, path) {
  if (!path || !response) return
  const key = `${response.user_id}::${path}`
  downloadingFile.value = { ...downloadingFile.value, [key]: true }
  try {
    await fetchDownload(path, eventId)
  } finally {
    downloadingFile.value = { ...downloadingFile.value, [key]: false }
  }
}

// Ordered list of { field, value } pairs for a response, using the version
// snapshot's order so answers appear in the same order the student saw them.
function answerEntries(response) {
  if (!response) return []
  const fields = response.form_version_fields || []
  const answers = response.answers || {}
  return fields.map((f) => ({ field: f, value: answers[f.key] }))
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function initials(name) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

onMounted(fetchAttendees)
</script>

<template>
  <div class="manage-attendees-container">
    <div class="header">
      <button class="back-btn" @click="router.back()">← Back</button>
      <h1>Manage Attendees</h1>
      <p v-if="event">{{ event.event_title }}</p>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading attendees...</p>
    </div>

    <div v-else-if="!event" class="error">
      <p>Event not found or you don't have permission to view this event.</p>
    </div>

    <div v-else-if="!event.requires_registration" class="error">
      <p>This event does not require registration on UniVent.</p>
    </div>

    <div v-else class="content">
      <div class="event-info">
        <h2>{{ event.event_title }}</h2>
        <div class="stats">
          <div class="stat">
            <span class="label">Registered:</span>
            <span class="value">{{ registered.length }}</span>
          </div>
          <div class="stat">
            <span class="label">Waitlisted:</span>
            <span class="value">{{ waitlisted.length }}</span>
          </div>
          <div class="stat">
            <span class="label">Capacity:</span>
            <span class="value">{{ capacityDisplay }}</span>
          </div>
          <div class="stat">
            <span class="label">Event Date:</span>
            <span class="value">{{
              event.date ? new Date(event.date).toLocaleDateString() : 'TBA'
            }}</span>
          </div>
        </div>
      </div>

      <div class="attendees-section">
        <h3>Registered Attendees</h3>

        <div v-if="registered.length === 0" class="no-attendees">
          <p>No attendees registered yet.</p>
        </div>

        <div v-else class="attendees-list">
          <div v-for="(attendee, i) in registered" :key="attendee.user_id" class="attendee-card">
            <div class="attendee-info">
              <div class="avatar">
                <img
                  v-if="attendee.profile_pics"
                  :src="attendee.profile_pics"
                  :alt="attendee.user_name || 'User'"
                />
                <div v-else class="default-avatar">{{ initials(attendee.user_name) }}</div>
              </div>
              <div class="details">
                <h4>{{ attendee.user_name || 'Unknown User' }}</h4>
                <p>{{ attendee.user_email || 'No email' }}</p>
                <p class="meta">Registered: {{ formatDate(attendee.registered_at) }}</p>
              </div>
            </div>
            <div class="attendee-actions">
              <span class="position">#{{ i + 1 }}</span>
              <button
                v-if="hasCustomForm && attendee.has_submission"
                class="view-submission-btn"
                @click="openSubmission(attendee)"
              >
                View Submission
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="waitlisted.length > 0" class="attendees-section">
        <h3>Waitlisted</h3>
        <div class="attendees-list">
          <div
            v-for="(attendee, i) in waitlisted"
            :key="attendee.user_id"
            class="attendee-card waitlisted"
          >
            <div class="attendee-info">
              <div class="avatar">
                <img
                  v-if="attendee.profile_pics"
                  :src="attendee.profile_pics"
                  :alt="attendee.user_name || 'User'"
                />
                <div v-else class="default-avatar">{{ initials(attendee.user_name) }}</div>
              </div>
              <div class="details">
                <h4>{{ attendee.user_name || 'Unknown User' }}</h4>
                <p>{{ attendee.user_email || 'No email' }}</p>
                <p class="meta">Waitlisted: {{ formatDate(attendee.created_at) }}</p>
              </div>
            </div>
            <div class="attendee-actions">
              <span class="position">Position {{ attendee.waitlist_position || i + 1 }}</span>
              <button
                v-if="hasCustomForm && attendee.has_submission"
                class="view-submission-btn"
                @click="openSubmission(attendee)"
              >
                View Submission
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cancelled attendees (form events only — preserved for audit per PRD) -->
      <div v-if="hasCustomForm && cancelledAttendees.length > 0" class="attendees-section">
        <h3>Cancelled</h3>
        <p class="section-hint">
          These students cancelled their registration. Their form responses are preserved for your
          records.
        </p>
        <div class="attendees-list">
          <div
            v-for="attendee in cancelledAttendees"
            :key="attendee.user_id"
            class="attendee-card cancelled"
          >
            <div class="attendee-info">
              <div class="avatar">
                <img
                  v-if="attendee.profile_pics"
                  :src="attendee.profile_pics"
                  :alt="attendee.user_name || 'User'"
                />
                <div v-else class="default-avatar">{{ initials(attendee.user_name) }}</div>
              </div>
              <div class="details">
                <h4>{{ attendee.user_name || 'Unknown User' }}</h4>
                <p>{{ attendee.user_email || 'No email' }}</p>
                <p class="meta">
                  Cancelled (was registered: {{ formatDate(attendee.registered_at) }})
                </p>
              </div>
            </div>
            <div class="attendee-actions">
              <button class="view-submission-btn" @click="openSubmission(attendee)">
                View Submission
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Submission detail drawer -->
    <teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="selectedAttendee" class="drawer-overlay" @click="closeSubmission">
          <div class="drawer-card" @click.stop>
            <button class="drawer-close" @click="closeSubmission">
              <PhX :size="18" />
            </button>

            <!-- Attendee header -->
            <div class="drawer-header">
              <div class="avatar">
                <img
                  v-if="selectedAttendee.profile_pics"
                  :src="selectedAttendee.profile_pics"
                  :alt="selectedAttendee.user_name || 'User'"
                />
                <div v-else class="default-avatar">
                  {{ initials(selectedAttendee.user_name) }}
                </div>
              </div>
              <div>
                <h2>{{ selectedAttendee.user_name || 'Unknown User' }}</h2>
                <p>{{ selectedAttendee.user_email || 'No email' }}</p>
              </div>
            </div>

            <!-- Registration state -->
            <div class="drawer-section">
              <h3 class="drawer-section-title">Registration</h3>
              <div class="reg-grid">
                <div class="reg-item">
                  <span class="reg-label">Status</span>
                  <span class="reg-value">
                    <span
                      class="status-pill"
                      :class="`status-pill--${selectedAttendee.registration_status}`"
                    >
                      {{ selectedAttendee.registration_status }}
                    </span>
                  </span>
                </div>
                <div class="reg-item" v-if="selectedAttendee.registered_at">
                  <span class="reg-label"><PhCalendar :size="13" /> Registered at</span>
                  <span class="reg-value">{{ formatDate(selectedAttendee.registered_at) }}</span>
                </div>
                <div class="reg-item" v-if="selectedAttendee.waitlisted_at">
                  <span class="reg-label"><PhClock :size="13" /> Waitlisted at</span>
                  <span class="reg-value">{{ formatDate(selectedAttendee.waitlisted_at) }}</span>
                </div>
                <div class="reg-item" v-if="selectedAttendee.waitlist_position">
                  <span class="reg-label">Waitlist position</span>
                  <span class="reg-value">#{{ selectedAttendee.waitlist_position }}</span>
                </div>
                <div class="reg-item">
                  <span class="reg-label">Submitted</span>
                  <span class="reg-value">{{ formatDate(selectedAttendee.submitted_at) }}</span>
                </div>
                <div
                  class="reg-item"
                  v-if="
                    selectedAttendee.updated_at &&
                    selectedAttendee.updated_at !== selectedAttendee.submitted_at
                  "
                >
                  <span class="reg-label">Last edited</span>
                  <span class="reg-value">{{ formatDate(selectedAttendee.updated_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Form responses -->
            <div class="drawer-section">
              <h3 class="drawer-section-title">
                <PhListChecks :size="16" /> Form Responses
                <span class="version-tag"
                  >v{{ selectedAttendee.form_version_id ? '(submitted version)' : '' }}</span
                >
              </h3>
              <div v-if="answerEntries(selectedAttendee).length === 0" class="no-answers">
                No answers recorded for this submission.
              </div>
              <div v-else class="answers-list">
                <div
                  v-for="(entry, i) in answerEntries(selectedAttendee)"
                  :key="i"
                  class="answer-row"
                >
                  <div class="answer-label">
                    {{ entry.field?.label || entry.field?.key || '(unknown field)' }}
                    <span v-if="entry.field?.required" class="req-mark">*</span>
                  </div>
                  <div
                    class="answer-value"
                    :class="{
                      'answer-value--file':
                        entry.field?.type === 'file' || entry.field?.type === 'image',
                    }"
                  >
                    <template
                      v-if="
                        (entry.field?.type === 'file' || entry.field?.type === 'image') &&
                        entry.value
                      "
                    >
                      <PhPaperclip :size="14" />
                      <button
                        type="button"
                        class="file-download-btn"
                        :disabled="downloadingFile[`${selectedAttendee.user_id}::${entry.value}`]"
                        @click="handleDownloadAttendeeFile(selectedAttendee, entry.value)"
                      >
                        <span>{{ formatAnswer(entry.field, entry.value) }}</span>
                        <PhDownloadSimple :size="13" />
                      </button>
                    </template>
                    <template v-else>
                      <PhPaperclip
                        v-if="entry.field?.type === 'file' || entry.field?.type === 'image'"
                        :size="14"
                      />
                      <span>{{ formatAnswer(entry.field, entry.value) }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>
  </div>
</template>

<style scoped>
.manage-attendees-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 30px;
}

.header h1 {
  font-size: 2rem;
  color: #1f1f1f;
  margin-bottom: 5px;
}

.header p {
  color: #666;
  font-size: 1.1rem;
}

.back-btn {
  background: transparent;
  border: 1px solid #eaeaea;
  border-radius: 8px;
  padding: 6px 14px;
  margin-bottom: 12px;
  cursor: pointer;
  color: #1969fe;
  font-weight: 600;
}

.loading,
.error {
  text-align: center;
  padding: 50px;
  font-size: 1.1rem;
}

.content {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.event-info {
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 30px;
}

.event-info h2 {
  font-size: 1.5rem;
  color: #1f1f1f;
  margin-bottom: 15px;
}

.stats {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat .label {
  font-size: 0.9rem;
  color: #666;
}

.stat .value {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f1f1f;
}

.attendees-section h3 {
  font-size: 1.3rem;
  color: #1f1f1f;
  margin-bottom: 20px;
}

.no-attendees {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 1.1rem;
}

.attendees-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.attendee-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fafafa;
}

.attendee-card.waitlisted {
  background: #fffdf0;
  border-color: #f0e0a0;
}

.attendee-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-avatar {
  width: 100%;
  height: 100%;
  background: #1969fe;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.2rem;
}

.details h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #1f1f1f;
}

.details p {
  margin: 4px 0 0 0;
  color: #666;
  font-size: 0.9rem;
}

.details .meta {
  font-size: 0.8rem;
  color: #999;
}

.position {
  font-weight: 600;
  color: #1969fe;
  font-size: 0.95rem;
}

@media (max-width: 768px) {
  .manage-attendees-container {
    padding: 15px;
  }

  .content {
    padding: 20px;
  }

  .stats {
    flex-direction: column;
    gap: 15px;
  }

  .attendee-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .attendee-actions {
    width: 100%;
    justify-content: space-between;
  }
}

/* ---- Stage 6F additions ---- */
.attendee-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-submission-btn {
  padding: 6px 14px;
  background: #f0f7ff;
  border: 1px solid #bad2ff;
  color: #1969fe;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.view-submission-btn:hover {
  background: #1969fe;
  color: #fff;
  border-color: #1969fe;
}

.attendee-card.cancelled {
  background: #f8f8f8;
  border-color: #e0e0e0;
  opacity: 0.85;
}
.attendee-card.cancelled .details h4 {
  text-decoration: line-through;
  color: #999;
}

.section-hint {
  font-size: 0.85rem;
  color: #999;
  margin: -10px 0 15px 0;
}

/* ---- Submission detail drawer ---- */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
}

.drawer-card {
  background: #ffffff;
  width: 100%;
  max-width: 480px;
  height: 95%;
  overflow-y: auto;
  padding: 24px;
  position: relative;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.15);
}

.drawer-close {
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
.drawer-close:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
  padding-right: 32px;
}
.drawer-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #1f1f1f;
}
.drawer-header p {
  margin: 4px 0 0 0;
  color: #666;
  font-size: 0.9rem;
}

.drawer-section {
  border-top: 1px solid #eee;
  padding-top: 18px;
  margin-top: 18px;
}
.drawer-section:first-of-type {
  border-top: none;
  margin-top: 0;
}

.drawer-section-title {
  font-size: 1rem;
  color: #1f1f1f;
  margin: 0 0 14px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.version-tag {
  font-size: 0.7rem;
  color: #999;
  font-weight: normal;
  margin-left: auto;
}

.reg-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.reg-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}
.reg-label {
  color: #666;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.reg-value {
  color: #1f1f1f;
  font-weight: 500;
}

.status-pill {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}
.status-pill--registered {
  background: #dcfce7;
  color: #16a34a;
}
.status-pill--cancelled {
  background: #fee2e2;
  color: #dc2626;
}
.status-pill--none {
  background: #fef3c7;
  color: #b45309;
}

.no-answers {
  color: #999;
  font-size: 0.9rem;
  padding: 16px 0;
}

.answers-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.answer-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}
.answer-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}
.req-mark {
  color: #dc2626;
}
.answer-value {
  font-size: 0.95rem;
  color: #1f1f1f;
  word-break: break-word;
}
.answer-value--file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1969fe;
}
.file-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  color: #1969fe;
  font-size: inherit;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
}
.file-download-btn:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
