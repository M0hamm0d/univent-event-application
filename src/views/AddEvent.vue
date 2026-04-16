<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useEvents } from '@/composables/useEvent'
import DownloadIcon from '@/components/icons/DownloadIcon.vue'
import { supabase } from '@/supabase'
import BackArrow from '@/components/icons/BackArrow.vue'
import { useRoute } from 'vue-router'
import { onMounted } from 'vue'

const toast = useToast()
const { uploadFile, saveEvent } = useEvents()
const currentUser = ref('')
const route = useRoute()
const eventId = route.query.id

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
  end_date: '',
  event_format: '',
  user_name: '',
  user_email: '',
  user_id: '',
  external_registration_link: '',
})
const is_multi_day = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const currentFileName = ref('')
const selectedCategories = ref([])

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
    time: eventData.value.time, // keep 24-hour format
  }

  const { imageUrl, linkToRegister, title, ...rest } = eventData.value

  const updatePayload = {
    ...rest,
    category: selectedCategories.value,
    end_date: eventData.value.end_date || null,
    date: eventData.value.date || null,
    time: eventData.value.time,
    image_url: imageUrl,
    link_to_register: linkToRegister,
    event_title: title,
  }

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
    resetForm()
  } else {
    loading.value = true
    try {
      result = await saveEvent(payload)
      if (!result.success) {
        throw new Error(result.error)
      }
      resetForm()
      toast.success('Event submitted successfully')
      await fetch('/api/send-submission-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: eventData.value.user_email,
          name: eventData.value.user_name,
          event: eventData.value.title,
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

function resetForm() {
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
  }
  selectedCategories.value = []
  currentFileName.value = ''
  is_multi_day.value = false
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

onMounted(async () => {
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
    }

    // ✅ FIX category
    selectedCategories.value = (data.category || []).map(
      (c) => c.charAt(0).toUpperCase() + c.slice(1),
    )

    // ✅ FIX filename
    currentFileName.value = data.image_url ? data.image_url.split('/').pop() : ''
  }
})
</script>
<template>
  <div class="create-event-page">
    <div class="form-header">
      <RouterLink to="/" class="back-nav">
        <BackArrow />
        <h1>Create New Event</h1>
      </RouterLink>
      <p class="subtitle">Kindly complete the form below to submit your event. After submission, it will be reviewed by our team.</p>
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
        </div>
      </section>

      <hr class="divider" />

      <section class="form-section">
        <div class="section-info">
          <h3>Time & Location</h3>
          <p>Where and when is it happening?</p>
        </div>
        <div class="section-fields card">
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
            <label>Capacity</label>
            <input
              v-model="eventData.capacity"
              type="number"
              placeholder="Leave empty for unlimited"
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
</style>
