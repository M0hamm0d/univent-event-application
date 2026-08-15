<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useEvents } from '@/composables/useEvent'
import DownloadIcon from '@/components/icons/DownloadIcon.vue'
import { supabase } from '@/supabase'
import BackArrow from '@/components/icons/BackArrow.vue'
import { useRoute } from 'vue-router'
import { onMounted, onUnmounted } from 'vue'
import FormBuilderModal from '@/components/forms/FormBuilderModal.vue'
import { validateFields, useRegistrationForm } from '@/composables/useRegistrationForm'

const toast = useToast()
const { uploadFile, saveEvent } = useEvents()
const { createFormDraft, saveDraft, publish } = useRegistrationForm()
const currentUser = ref('')
const route = useRoute()
const eventId = route.query.id

// ---------------------------------------------------------------------------
// Custom registration form state.
//
// AddEvent owns the overall event-creation state, including the in-memory
// custom-form DRAFT for new events. The draft lives ONLY in `pendingFormDraft`
// (a plain object) until the event is successfully created. Then — and only
// then — we persist it via useRegistrationForm (createFormDraft → saveDraft →
// publish if requested). This means opening/closing the FormBuilder never
// creates any registration_forms / registration_form_versions rows just
// because the organizer explored the builder.
//
// For EXISTING events (edit mode) the form already has an id, so the builder
// runs in 'live' mode and reads/writes Supabase directly against `eventId`.
//
// `formBuilderKey` is bumped whenever the builder is (re)opened so the
// FormBuilder component remounts with fresh props (important for local mode,
// so an updated pendingFormDraft seed re-hydrates the editor cleanly).
// ---------------------------------------------------------------------------
const pendingFormDraft = ref(null) // { title, description, fields, status } | null
const formBuilderOpen = ref(false)
const formBuilderMode = ref('live') // 'live' | 'local'
const formBuilderKey = ref(0)
// True for an existing event that already has a registration_forms row. We
// probe for it on mount so the summary card can offer "Edit Registration Form".
const existingFormDetected = ref(false)

const hasCustomForm = computed(
  () => !!pendingFormDraft.value || existingFormDetected.value,
)

// Colored dot for the summary card. 'draft' (or nothing yet) is neutral,
// 'published' is the brand accent. Only meaningful for the in-memory draft.
const pendingFormDraftStatusClass = computed(() => {
  if (pendingFormDraft.value?.status === 'published') return 'custom-form-summary__tag--published'
  return 'custom-form-summary__tag--draft'
})

// FormBuilder is only available for UniVent-registrable events without an
// external registration link (the same gate as Stage 0's registration mode).
const canCustomizeForm = computed(
  () => eventData.value.requires_registration && !eventData.value.external_registration_link,
)

const eventData = ref({
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  category: [],
  imageUrl: '',
  linkToRegister: '',
  requires_registration: false,
  capacity: '',
  end_date: '',
  event_format: '',
  user_name: '',
  user_email: '',
  user_id: '',
  external_registration_link: '',
  faculty: '',
})
const is_multi_day = ref(false)
const date_not_fixed = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const currentFileName = ref('')
const selectedCategories = ref([])

const facultyOptions = [
  'Faculty of Agriculture',
  'Faculty of Arts',
  'Faculty of Education',
  'Faculty of Engineering and Technology',
  'Faculty of Law',
  'Faculty of Environmental Sciences',
  'Faculty of Management Sciences',
  'Faculty of Social Sciences',
  'Faculty of Life Sciences',
  'Faculty of Physical Sciences',
  'Faculty of Pharmaceutical Sciences',
  'Faculty of Veterinary Medicine',
  'Faculty of Communication and Information Sciences',
  'Faculty of Basic Medical Sciences',
  'Faculty of Clinical Sciences',
  'Faculty of Health Sciences',
]

const categoryOptions = [
  'Academic',
  'Social',
  'Cultural',
  'Sports',
  'Workshop',
  'Career',
  'Organization',
  'Tech',
]

async function getUserId() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    let { data: profile, error: profile_error } = await supabase
      .from('profile')
      .select('*')
      .eq('id', `${user.id}`)
    eventData.value.user_email = profile[0].user_email
    eventData.value.user_name = profile[0].user_name
    eventData.value.user_id = profile[0].id
    currentUser.value = user
    if (error || profile_error) throw error
    // Restore any in-progress custom-form draft for NEW events after we know
    // the organizer id (localStorage is keyed by user id). Live/edit mode
    // loads its form from Supabase in onMounted instead.
    loadDraftFromStorage()
  } catch (error) {
    console.log(error)
  }
}

getUserId()

async function handleFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const maxSize = 3 * 1024 * 1024
  loading.value = true
  if (file.size > maxSize) {
    toast.error('File is too large! Please upload an image under 3MB.')
    loading.value = false
    return
  }
  const result = await uploadFile(file, currentFileName.value)
  loading.value = false

  if (result.success) {
    eventData.value.imageUrl = result.url
    currentFileName.value = result.fileName
  } else {
    errorMessage.value = result.error
    toast.error(result.error)
  }
}

async function handleSaveEvent() {
  // VALIDATIONS
  if (eventData.value.external_registration_link && eventData.value.requires_registration) {
    toast.error('You cannot provide an external link AND register on UniVent. Please choose one.')
    return
  }

  if (is_multi_day.value && !eventData.value.end_date) {
    toast.error('Please provide an end date for multi-day events')
    return
  }

  if (!date_not_fixed.value && !eventData.value.date) {
    toast.error('Please provide a date for the event or select "I\'m not sure about the date yet"')
    return
  }

  if (date_not_fixed.value && eventData.value.date) {
    toast.error('Please unselect the date or uncheck "I\'m not sure about the date yet"')
    return
  }

  if (is_multi_day.value && eventData.value.end_date < eventData.value.date) {
    toast.error('End date cannot be before start date')
    return
  }

  if (eventData.value.requires_registration && eventData.value.capacity) {
    const capacityNum = parseInt(eventData.value.capacity)
    if (isNaN(capacityNum) || capacityNum < 0) {
      toast.error('Capacity must be a positive number')
      return
    }
  }

  if (
    (eventData.value.event_format === 'virtual' && !eventData.value.linkToRegister) ||
    (eventData.value.event_format === 'hybrid' && !eventData.value.linkToRegister)
  ) {
    toast.error('Please provide a meeting or streaming link')
    return
  }

  if (eventData.value.event_format === 'physical' && !eventData.value.location) {
    toast.error('Please provide a location for physical events')
    return
  }

  if (!eventData.value.date) {
    toast.error('Please provide a date for the event')
    return
  }

  if (
    eventData.value.event_format === 'hybrid' &&
    (!eventData.value.location || !eventData.value.linkToRegister)
  ) {
    toast.error('Please provide both a location and a link for hybrid events')
    return
  }

  if (selectedCategories.value.length === 0) {
    toast.error('Please select at least one category')
    return
  }

  if (!eventData.value.imageUrl) {
    toast.error('Please upload an event image')
    return
  }

  if (eventData.value.event_format === 'virtual') {
    eventData.value.location = ''
  }

  // PREPARE PAYLOAD
  const payload = {
    ...eventData.value,
    category: selectedCategories.value,
    end_date: eventData.value.end_date || null,
    date: eventData.value.date || null,
    time: eventData.value.time,
    faculty: eventData.value.faculty || null,
    date_not_fixed: date_not_fixed.value,
  }

  const { imageUrl, linkToRegister, user_email, title, ...rest } = eventData.value

  const updatePayload = {
    ...rest,
    category: selectedCategories.value,
    end_date: eventData.value.end_date || null,
    date_not_fixed: date_not_fixed.value || false,
    date: eventData.value.date || null,
    time: eventData.value.time,
    image_url: imageUrl,
    link_to_register: linkToRegister,
    event_title: title,
    faculty: eventData.value.faculty || null,
    capacity:
      eventData.value.requires_registration &&
      eventData.value.capacity !== '' &&
      eventData.value.capacity !== undefined &&
      eventData.value.capacity !== null
        ? parseInt(eventData.value.capacity, 10)
        : null,
    email: user_email,
  }

  console.log(updatePayload, 'aaa')

  let result

  if (eventId) {
    // UPDATE EXISTING EVENT
    console.log(updatePayload, 'bbb')
    const { data, error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .select()
      .maybeSingle()

    if (error) {
      toast.error('Failed to update event: ' + error.message)
      return
    }

    toast.success('Event updated successfully')
    result = data
    // Existing event: the form already attaches to the event id and the
    // FormBuilder runs in live mode. Keep the builder open after the update.
    resetForm({ keepBuilderOpen: true })
  } else {
    loading.value = true
    try {
      // 1) Pre-validate the in-memory custom-form draft BEFORE creating the
      //    event so a malformed draft doesn't leave us with a saved event and
      //    no form. The authoritative validator is the DB RPC; this is the
      //    same client-side check FormBuilder uses.
      if (pendingFormDraft.value) {
        const errs = validateFields(pendingFormDraft.value.fields || [])
        if (errs.length) {
          toast.error('Your custom form has errors: ' + errs.join(' '))
          return
        }
      }

      // 2) Create the event row and get its id.
      result = await saveEvent(payload)
      if (!result.success) {
        throw new Error(result.error)
      }
      const newEventId = result.id

      // 3) Persist the custom registration form (if any) using that event id.
      //    Done best-effort: the event row already exists, so a form-persist
      //    failure leaves the event intact and the organizer can retry from
      //    /add-event?id=<newId>. We do NOT roll the event back.
      if (pendingFormDraft.value && newEventId) {
        await attachPendingForm(newEventId)
      }

      // 4) Capture the organizer's identity + event title BEFORE resetForm
      //    clears eventData (the confirmation email needs them).
      const organizerEmail = eventData.value.user_email
      const organizerName = eventData.value.user_name
      const eventTitle = eventData.value.title

      // 5) Reset the on-screen event fields (and clear the now-persisted
      //    draft) before telling the user everything succeeded.
      resetForm()
      toast.success('Event submitted successfully')
      await fetch('/api/send-submission-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: organizerEmail,
          name: organizerName,
          event: eventTitle,
        }),
      })
    } catch (err) {
      console.error('Error saving event:', err)
      toast.error('Failed to save event: ' + err.message)
      return
    } finally {
      loading.value = false
    }
  }
}

/**
 * attachPendingForm(eventId)
 *   Replays the in-memory draft into Supabase now that the event exists. Steps:
 *     i.   createFormDraft  → registration_forms row (status 'draft', empty)
 *     ii.  saveDraft        → persist title/description/fields_draft
 *     iii. publish (RPC)    → only when pendingFormDraft.status === 'published'
 *   Each step is reported independently via toast; the event stays in place
 *   regardless. Reuses useRegistrationForm so there's a single persistence path
 *   shared with the live FormBuilder.
 */
async function attachPendingForm(newEventId) {
  const d = pendingFormDraft.value
  if (!d) return
  try {
    const created = await createFormDraft({
      eventId: newEventId,
      organizerId: eventData.value.user_id,
      title: d.title || 'Registration Form',
      description: d.description || '',
    })
    if (!created.success) {
      toast.error('Could not attach your custom form: ' + created.error + ' Open the event to retry.')
      return
    }
    const saved = await saveDraft(created.form.id, {
      title: d.title || 'Registration Form',
      description: d.description || '',
      fields_draft: d.fields || [],
    })
    if (!saved.success) {
      toast.error('Saved the event, but the form fields failed: ' + saved.error + ' Open the event to retry.')
      return
    }
    if (d.status === 'published') {
      const pub = await publish(created.form.id, d.fields || [])
      if (!pub.success) {
        toast.error('Form saved as a draft, but publishing failed: ' + pub.error + ' You can publish it later from the event editor.')
      }
    }
  } catch (e) {
    toast.error('Could not attach your custom form: ' + (e.message || e) + ' Open the event to retry.')
  }
}

// `resetForm` clears the event-input fields on screen + the custom-form UI
// state. Both the create and update paths call it after a successful write.
//
// `keepBuilderOpen=true` is passed on the EXISTING-event update path so the
// FormBuilder section stays usable after the update (matches prior behavior,
// where the builder remained visible on edit). On the NEW-event path we pass
// false (default) so the draft clears — by that point the form has already
// been persisted against the newly-created event id, so the in-memory draft
// is obsolete.
function resetForm({ keepBuilderOpen = false } = {}) {
  eventData.value = {
    title: '',
    description: '',
    date: '',
    end_date: '',
    time: '',
    location: '',
    category: [],
    imageUrl: '',
    linkToRegister: '',
    requires_registration: false,
    capacity: '',
    event_format: '',
    user_name: '',
    user_email: '',
    user_id: '',
    external_registration_link: '',
    faculty: '',
  }
  selectedCategories.value = []
  currentFileName.value = ''
  is_multi_day.value = false
  if (!keepBuilderOpen) {
    pendingFormDraft.value = null
    formBuilderOpen.value = false
    // The new-event draft has now been persisted against the created event id
    // (or the update path doesn't use localStorage at all), so drop the
    // in-progress localStorage mirror.
    clearDraftStorage()
  }
}

function convertTo24Hour(time12h) {
  if (!time12h) return ''

  const [time, modifier] = time12h.split(/(AM|PM)/)
  let [hours, minutes] = time.split(':')

  hours = parseInt(hours)

  if (modifier === 'PM' && hours !== 12) {
    hours += 12
  }
  if (modifier === 'AM' && hours === 12) {
    hours = 0
  }

  return `${String(hours).padStart(2, '0')}:${minutes}`
}
const handleBeforeUnload = (e) => {
  e.preventDefault()
  e.returnValue = ''
}

// --- Custom registration form handlers -------------------------------------
//
// openFormBuilder:  mount the FormBuilder (now inside FormBuilderModal). New
//                   events run in 'local' mode (pure in-memory draft, no DB
//                   rows); existing events run in 'live' mode (direct Supabase
//                   reads/writes via the already-attached registration_forms
//                   row).
// onFormSaved:      replace the pending draft with whatever the organizer just
//                   finished designing and close the modal. The draft here is
//                   {title, description, fields, status}; in local mode it is
//                   returned from FormBuilder.saveDraft() and forwarded by the
//                   modal. Also mirrors the draft to localStorage (new events).
// onFormCancelled:  the organizer clicked "Cancel" (or backdrop/Esc) inside
//                   the modal. Keep any existing pending draft (only a never-
//                   saved, brand-new draft is effectively dropped because
//                   there isn't one yet) so they can reopen and continue.
// removeCustomForm: explicitly discard the in-memory draft (and its localStorage
//                   mirror) so the event falls back to the default registration
//                   flow. Only applies to new events (existing events edit
//                   their form live).
//
// --- localStorage draft persistence (NEW events only) ---------------------
// For new events the custom-form draft lives only in memory until "Create
// Event" is clicked. To let an organizer close the modal / refresh the page
// and continue later, we mirror `pendingFormDraft` to localStorage keyed by
// the organizer's user id. Live (edit) mode persists straight to Supabase so
// it doesn't need this. The key is cleared on successful event creation and
// on explicit "Remove custom form".
// ---------------------------------------------------------------------------
const DRAFT_STORAGE_PREFIX = 'univent:regform:draft:'
function draftStorageKey() {
  const uid = eventData.value.user_id || 'anon'
  return DRAFT_STORAGE_PREFIX + uid
}
function persistDraftToStorage() {
  if (eventId) return // only new events
  try {
    if (pendingFormDraft.value) {
      localStorage.setItem(draftStorageKey(), JSON.stringify(pendingFormDraft.value))
    } else {
      localStorage.removeItem(draftStorageKey())
    }
  } catch {
    // localStorage may be unavailable (private mode / quota); fail silently.
  }
}
function loadDraftFromStorage() {
  if (eventId) return // only new events
  try {
    const raw = localStorage.getItem(draftStorageKey())
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.fields)) {
      pendingFormDraft.value = parsed
    }
  } catch {
    // Corrupt entry — ignore.
  }
}
function clearDraftStorage() {
  try {
    localStorage.removeItem(draftStorageKey())
  } catch {
    // ignore
  }
}

function openFormBuilder() {
  formBuilderMode.value = eventId ? 'live' : 'local'
  formBuilderKey.value++
  formBuilderOpen.value = true
}
function onFormSaved(draft) {
  pendingFormDraft.value = draft
  formBuilderOpen.value = false
  persistDraftToStorage()
}
function onFormCancelled() {
  // Per the agreed contract: a cancel preserves any draft that was already
  // saved earlier. A brand-new draft that was never saved just never reaches
  // pendingFormDraft, so there's nothing to clean up here.
  formBuilderOpen.value = false
}
function removeCustomForm() {
  pendingFormDraft.value = null
  formBuilderOpen.value = false
  clearDraftStorage()
  toast.info('Custom form removed. The event will use the default registration flow.')
}
onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  if (!eventId) return

  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()

  if (error) {
    console.error(error)
    toast.error('Error loading event data')
    return
  }

  if (data) {
    eventData.value = {
      title: data.event_title,
      imageUrl: data.image_url,
      time: convertTo24Hour(data.time), // ✅ FIX
      date: data.date,
      location: data.location,
      description: data.description,
      event_format: data.event_format,
      linkToRegister: data.link_to_register,
      requires_registration: data.requires_registration,
      capacity: data.capacity,
      end_date: data.end_date,
      external_registration_link: data.external_registration_link,
      faculty: data.faculty || '',
    }

    // ✅ FIX category
    selectedCategories.value = (data.category || []).map(
      (c) => c.charAt(0).toUpperCase() + c.slice(1),
    )

    // ✅ FIX filename
    currentFileName.value = data.image_url ? data.image_url.split('/').pop() : ''

    // ✅ Detect an existing custom registration form for this event so the
    // builder section opens automatically on edit. RLS filters to the
    // organizer's own events; a non-owner would get null here.
    if (data.requires_registration && !data.external_registration_link) {
      const { data: existingForm } = await supabase
        .from('registration_forms')
        .select('id, status')
        .eq('event_id', eventId)
        .maybeSingle()
      if (existingForm) {
        existingFormDetected.value = true
        formBuilderMode.value = 'live'
        // Preserve prior UX: auto-open the live builder on edit when a form
        // already exists. A fresh key makes FormBuilder load the DB form once.
        formBuilderKey.value++
        formBuilderOpen.value = true
      }
    }
  }
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>
<template>
  <div class="create-event-page">
    <div class="form-header">
      <RouterLink to="/" class="back-nav">
        <BackArrow />
        <h1>Create New Event</h1>
      </RouterLink>
      <p class="subtitle">
        Kindly complete the form below to submit your event. After submission, it will be reviewed
        by our team.
      </p>
    </div>

    <div class="form-container">
      <section class="form-section">
        <div class="section-info">
          <h3>Event Details</h3>
          <p>Provide the core information about your event.</p>
        </div>
        <div class="section-fields card">
          <div class="field-group">
            <label>Event Title</label>
            <input v-model="eventData.title" type="text" placeholder="e.g. Annual Tech Summit" />
          </div>

          <div class="field-group">
            <label>Description</label>
            <textarea
              v-model="eventData.description"
              rows="4"
              placeholder="Tell us about the event..."
            ></textarea>
          </div>

          <div class="field-group">
            <label>Categories (Select up to 3)</label>
            <div class="category-grid">
              <div v-for="(cat, i) in categoryOptions" :key="i" class="cat-pill">
                <input
                  type="checkbox"
                  :id="cat"
                  :value="cat"
                  v-model="selectedCategories"
                  :disabled="selectedCategories.length >= 3 && !selectedCategories.includes(cat)"
                />
                <label :for="cat">{{ cat }}</label>
              </div>
            </div>
          </div>
          <div class="field-group">
            <label>
              Faculty
              <span class="optional">(Optional)</span>
            </label>
            <select v-model="eventData.faculty" class="faculty-select">
              <option value="">Select a Faculty (None)</option>
              <option v-for="faculty in facultyOptions" :key="faculty" :value="faculty">
                {{ faculty }}
              </option>
            </select>
            <small class="helper-text-neutral"
              >Only select if this event is faculty-specific.</small
            >
          </div>
        </div>
      </section>

      <hr class="divider" />

      <section class="form-section">
        <div class="section-info">
          <h3>Time & Location</h3>
          <p>Where and when is it happening?</p>
        </div>
        <!-- <div class="section-fields card">
          <div class="row">
            <div class="field-group checkbox-row">
              <input v-model="is_multi_day" type="checkbox" id="multi-day" />
              <label for="multi-day">This is a multi-day event</label>
            </div>
          </div>

          <div class="row">
            <div class="field-group">
              <label>{{ is_multi_day ? 'Start Date' : 'Event Date' }}</label>
              <input v-model="eventData.date" type="date" />
            </div>
            <div class="field-group" v-if="is_multi_day">
              <label>End Date</label>
              <input v-model="eventData.end_date" type="date" />
            </div>
            <div class="field-group">
              <label>Start Time</label>
              <input v-model="eventData.time" type="time" />
            </div>
          </div>

          <div class="field-group">
            <label>Event Format (select one)</label>
            <div class="radio-group">
              <label class="radio-item"
                ><input type="radio" value="physical" v-model="eventData.event_format" />
                Physical</label
              >
              <label class="radio-item"
                ><input type="radio" value="virtual" v-model="eventData.event_format" />
                Virtual</label
              >
              <label class="radio-item"
                ><input type="radio" value="hybrid" v-model="eventData.event_format" />
                Hybrid</label
              >
            </div>
          </div>

          <div
            class="field-group"
            v-if="eventData.event_format !== 'virtual' && eventData.event_format !== ''"
          >
            <label>Physical Location</label>
            <input v-model="eventData.location" type="text" placeholder="Venue or Address" />
          </div>

          <div
            class="field-group"
            v-if="eventData.event_format !== 'physical' && eventData.event_format !== ''"
          >
            <label>Meeting Link</label>
            <input v-model="eventData.linkToRegister" type="text" placeholder="Zoom, Meet, etc." />
          </div>
        </div> -->
        <div class="section-fields card">
          <div class="row">
            <div class="field-group checkbox-row">
              <input v-model="is_multi_day" type="checkbox" id="multi-day" />
              <label for="multi-day">This is a multi-day event</label>
            </div>

            <div class="field-group checkbox-row">
              <input
                v-model="date_not_fixed"
                type="checkbox"
                id="date-not-fixed"
                @change="handleDateNotFixed"
              />
              <label for="date-not-fixed">I'm not sure about the date yet</label>
            </div>
          </div>

          <div class="row" v-if="!date_not_fixed">
            <div class="field-group">
              <label>{{ is_multi_day ? 'Start Date' : 'Event Date' }}</label>
              <input v-model="eventData.date" type="date" />
            </div>
            <div class="field-group" v-if="is_multi_day">
              <label>End Date</label>
              <input v-model="eventData.end_date" type="date" />
            </div>
            <div class="field-group">
              <label>Start Time</label>
              <input v-model="eventData.time" type="time" />
            </div>
          </div>

          <div class="field-group">
            <label>Event Format (select one)</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" value="physical" v-model="eventData.event_format" /> Physical
              </label>
              <label class="radio-item">
                <input type="radio" value="virtual" v-model="eventData.event_format" /> Virtual
              </label>
              <label class="radio-item">
                <input type="radio" value="hybrid" v-model="eventData.event_format" /> Hybrid
              </label>
            </div>
          </div>

          <div
            class="field-group"
            v-if="eventData.event_format !== 'virtual' && eventData.event_format !== ''"
          >
            <label>Physical Location</label>
            <input v-model="eventData.location" type="text" placeholder="Venue or Address" />
          </div>

          <div
            class="field-group"
            v-if="eventData.event_format !== 'physical' && eventData.event_format !== ''"
          >
            <label>Meeting Link</label>
            <input v-model="eventData.linkToRegister" type="text" placeholder="Zoom, Meet, etc." />
          </div>
        </div>
      </section>

      <hr class="divider" />

      <section class="form-section">
        <div class="section-info">
          <h3>Attendance & Media</h3>
          <p>Manage registration and upload flyers.</p>
        </div>
        <div class="section-fields card">
          <div class="field-group">
            <label>
              External Registration Link
              <span class="optional">(Optional)</span>
            </label>

            <input
              v-model="eventData.external_registration_link"
              type="text"
              placeholder="Paste a registration link (e.g. Google Forms, Eventbrite) if applicable"
            />

            <small class="helper-text">
              Provide a link only if your event requires external registration. Otherwise, you can
              leave this empty.
            </small>
          </div>
          <div class="field-group checkbox-row">
            <input v-model="eventData.requires_registration" type="checkbox" id="reg-req" />
            <label for="reg-req">Register on UniVent</label>
          </div>

          <div class="field-group" v-if="eventData.requires_registration">
            <label>
              Capacity
              <span class="optional">(Optional)</span>
            </label>
            <input
              v-model="eventData.capacity"
              type="number"
              min="0"
              placeholder="Leave empty for unlimited"
            />
            <small class="helper-text-neutral"
              >Number of spots. Leave empty for unlimited. Use 0 to close registration.</small
            >
          </div>

          <!-- ============================================================ -->
          <!-- Custom Registration Form (Stage 6B)                          -->
          <!-- Only relevant for UniVent-registrable events without an      -->
          <!-- external link. Independent from the default MODE 1 flow: if  -->
          <!-- the organizer skips this, the event keeps the existing simple -->
          <!-- RegisterModal + register_for_event flow.                     -->
          <!--                                                              -->
          <!-- State key:                                                   -->
          <!--   - Opt-in CTA      when !hasCustomForm && !formBuilderOpen   -->
          <!--   - Summary card    when hasCustomForm && !formBuilderOpen   -->
          <!--   - Inline builder  when formBuilderOpen                     -->
          <!-- For NEW events the builder runs in 'local' mode (in-memory   -->
          <!-- draft, persisted only at Create Event time). For EXISTING    -->
          <!-- events it runs in 'live' mode against the real event id.     -->
          <!-- ============================================================ -->
          <div v-if="canCustomizeForm" class="field-group">
            <label>
              Custom Registration Form
              <span class="optional">optional</span>
            </label>

            <!-- A) Opt-in: nothing configured, builder closed -->
            <div v-if="!hasCustomForm && !formBuilderOpen" class="custom-form-opt-in">
              <p>
                Add a custom form students fill in when registering (questions, file uploads, etc.).
                If you skip this, the event uses UniVent's default confirmation flow.
              </p>
              <button type="button" class="opt-in-btn" @click="openFormBuilder">
                Add Registration Form
              </button>
            </div>

            <!-- B) Summary: a custom form is configured, builder closed -->
            <div
              v-else-if="hasCustomForm && !formBuilderOpen"
              class="custom-form-summary"
            >
              <div class="custom-form-summary__main">
                <span class="custom-form-summary__tag" :class="pendingFormDraftStatusClass"></span>
                <div>
                  <p>
                    <strong>Custom registration form configured</strong>
                    <template v-if="pendingFormDraft">
                      · {{ pendingFormDraft.fields?.length || 0 }} field(s) ·
                      {{ pendingFormDraft.status === 'published' ? 'will be published' : 'saved as draft' }}
                      <em class="custom-form-summary__hint">(attached when you create the event)</em>
                    </template>
                    <template v-else-if="existingFormDetected">
                      · attached to this event
                      <em class="custom-form-summary__hint">(edited live against the saved event)</em>
                    </template>
                  </p>
                </div>
              </div>
              <div class="custom-form-summary__actions">
                <button type="button" class="opt-in-btn" @click="openFormBuilder">
                  Edit Registration Form
                </button>
                <button
                  v-if="pendingFormDraft"
                  type="button"
                  class="opt-in-btn opt-in-btn--ghost"
                  @click="removeCustomForm"
                >
                  Remove — use default registration
                </button>
              </div>
            </div>

            <!-- C) Builder open as a responsive modal (local for new events,
                 live for existing). Local: "Save & Publish" commits the draft
                 with status 'published' (attached on Create Event). Cancel
                 soft-preserves in-progress edits so reopen restores them until
                 the event is created. Live: Save Draft persists to Supabase,
                 Publish pushes a new version, Cancel discards unsaved edits. -->
            <FormBuilderModal
              v-else
              :key="formBuilderKey"
              :mode="formBuilderMode"
              :event-id="eventId || null"
              :organizer-id="eventData.user_id"
              :initial-draft="pendingFormDraft"
              @saved="onFormSaved"
              @cancel="onFormCancelled"
            />
          </div>

          <div class="field-group">
            <label>Event Flier (Max 3MB)</label>
            <div class="upload-zone">
              <input id="uploadFile" type="file" @change="handleFileUpload" hidden />
              <label for="uploadFile" class="upload-label">
                <DownloadIcon />
                <span>{{ currentFileName || 'Click to upload image' }}</span>
              </label>
              <div v-if="eventData.imageUrl" class="image-preview">
                <img :src="eventData.imageUrl" alt="Preview" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="form-actions">
        <button class="btn-cancel">Cancel</button>
        <div class="">
          <button v-if="eventId" class="btn-save" @click="handleSaveEvent" :disabled="loading">
            {{ loading ? 'updating event...' : 'Update Event' }}
          </button>
          <button v-else class="btn-save" @click="handleSaveEvent" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save Event' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
textarea {
  resize: none;
}
.create-event-page {
  max-width: 900px;
  margin: 40px auto;
  padding: 0 20px;
  font-family: 'Inter', system-ui, sans-serif;
  color: #334155;
}

/* Header Styling */
.form-header {
  margin-bottom: 40px;
}
.back-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #1e293b;
  margin-bottom: 20px;
}
.back-nav h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}
.subtitle {
  color: #64748b;
  font-size: 14px;
  margin-top: 8px;
}

/* Section Layout */
.form-section {
  display: flex;
  gap: 40px;
  margin-bottom: 30px;
}
.section-info {
  flex: 0 0 250px;
}
.section-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
}
.section-info p {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}
.section-fields {
  flex: 1;
}

/* Card & Inputs */
.card {
  background: white;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.field-group label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}
input[type='text'],
input[type='number'],
input[type='date'],
input[type='time'],
textarea {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}
input:focus,
textarea:focus {
  outline: none;
  /* border-color: #6366f1; */
  border-color: #055dfa;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* Categories */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}
.cat-pill {
  position: relative;
}
.cat-pill input {
  display: none;
}
.cat-pill label {
  display: block;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  border: 1px solid transparent;
}
.cat-pill input:checked + label {
  /* background: #6366f1; */
  background: #055dfa;
  color: white;
}

.faculty-select {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 14px;
  cursor: pointer;
  appearance: none; /* Removes default browser arrow */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 16px;
}

.faculty-select:focus {
  outline: none;
  border-color: #055dfa;
  background-color: #fff;
}

/* Neutral helper text for optional fields */
.helper-text-neutral {
  font-size: 12px;
  color: #94a3b8;
  margin-top: -4px;
}

/* Utils */
.row {
  display: flex;
  gap: 16px;
}
.row > div {
  flex: 1;
}
.checkbox-row {
  flex-direction: row !important;
  align-items: center;
}
.radio-group {
  display: flex;
  gap: 20px;
}
.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.divider {
  border: 0;
  border-top: 1px solid #f1f5f9;
  margin: 30px 0;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}

.optional {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 999px;
}

.text-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 14px;
  transition: all 0.2s ease;
}

.text-input:focus {
  outline: none;
  border-color: #055dfa;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(5, 93, 250, 0.1);
}

/* Helper text */
.helper-text {
  font-size: 12px;
  color: #94a3b8;
  color: red;
  line-height: 1.4;
  margin-top: -4px;
}

/* Upload Area */
.upload-zone {
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  background: #f8fafc;
}
.upload-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #64748b;
}
.image-preview img {
  max-width: 200px;
  margin-top: 15px;
  border-radius: 8px;
}

/* Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 40px;
}
.btn-cancel {
  padding: 12px 24px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  color: #475569;
  font-weight: 500;
  cursor: pointer;
}
.btn-save {
  padding: 12px 32px;
  /* background: #6366f1; */
  background: #055dfa;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3);
}

@media (max-width: 768px) {
  .form-section {
    flex-direction: column;
    gap: 16px;
  }
  .section-info {
    flex: 0 0 auto;
  }
  .row {
    flex-direction: column;
  }
  .form-actions {
    margin-bottom: 120px;
  }
}

@media (max-width: 480px) {
  .category-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }
  .cat-pill label {
    font-size: 11px;
    padding: 12px 8px;
  }
}

/* Custom Registration Form (Stage 6B) */
.custom-form-opt-in,
.custom-form-pending {
  padding: 16px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.custom-form-opt-in p,
.custom-form-pending p {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
}

.custom-form-summary {
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.custom-form-summary__main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.custom-form-summary__tag {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-top: 6px;
  flex: 0 0 auto;
}
.custom-form-summary__tag--draft {
  background: #94a3b8;
}
.custom-form-summary__tag--published {
  background: #055dfa;
}
.custom-form-summary__main p {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
}
.custom-form-summary__hint {
  color: #94a3b8;
  font-size: 12px;
}
.custom-form-summary__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.custom-form-builder-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.custom-form-builder-wrap__back {
  align-self: flex-start;
}
.opt-in-btn {
  padding: 8px 16px;
  background: #055dfa;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.opt-in-btn:hover {
  background: #0447c4;
}
.opt-in-btn--ghost {
  background: transparent;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.opt-in-btn--ghost:hover {
  background: #f1f5f9;
}
</style>
