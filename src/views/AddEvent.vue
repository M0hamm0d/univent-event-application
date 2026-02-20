<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useEvents } from '@/composables/useEvent'
import DownloadIcon from '@/components/icons/DownloadIcon.vue'

const toast = useToast()
const { uploadFile, saveEvent } = useEvents()

const eventData = ref({
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  categories: [],
  imageUrl: '',
  linkToRegister: '',
  requires_registration: false,
  end_date: '',
  event_format: '',
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
  const requiredFields = ['title', 'description', 'date', 'time', 'location', 'imageUrl']
  const missing = requiredFields.filter((f) => !eventData.value[f])
  if (missing.length) {
    toast.error(`Missing: ${missing.join(', ')}`)
    return
  }
  if (eventData.value.time) {
    const [hour, min] = eventData.value.time.split(':')
    if (hour > 12) {
      eventData.value.time = `${hour - 12}:${min}PM`
    } else if (hour == 12) {
      eventData.value.time = `${hour}:${min}PM`
    } else if (hour == 0) {
      eventData.value.time = `${12}:${min}AM`
    } else {
      eventData.value.time = `${hour}:${min}AM`
    }
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
    eventData.value.event_format === 'virtual' ||
    (eventData.value.event_format === 'hybrid' && !eventData.value.linkToRegister)
  ) {
    toast.error('Please provide a meeting or streaming link')
    return
  }

  if (eventData.value.event_format === 'physical' && !eventData.value.location) {
    toast.error('Please provide a location for physical events')
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

  if (eventData.value.imageUrl === '') {
    toast.error('Please upload an event image')
    return
  }

  const result = await saveEvent({
    ...eventData.value,
    categories: selectedCategories.value,
  })

  if (result.success) {
    toast.success('Event submitted successfully')
    resetForm()
  } else {
    toast.error(result.error)
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
    categories: [],
    imageUrl: '',
    linkToRegister: '',
    requires_registration: false,
    capacity: '',
    event_format: '',
  }
  selectedCategories.value = []
  currentFileName.value = ''
  is_multi_day.value = false
}
</script>
<template>
  <div class="create-event-container">
    <RouterLink to="/" class="nav">
      <span>←</span>
      <h2>Create Event</h2>
    </RouterLink>

    <div class="create-event">
      <div class="basic-info">
        <h1>Event Info</h1>
        <div class="title">
          <input v-model="eventData.title" type="text" placeholder="" />
          <p>Event Title</p>
        </div>

        <div class="description">
          <textarea v-model="eventData.description" rows="6" placeholder=" "></textarea>
          <p>Description</p>
        </div>
        <div class="categories">
          <p>Category</p>
          <div class="no-of-categories">
            <p>{{ selectedCategories }}</p>
            <p>Pick up to 3</p>
          </div>
          <div class="categoryContainer">
            <div v-for="(cat, i) in categoryOptions" :key="i" class="cat">
              <input
                type="checkbox"
                :id="cat"
                :value="cat"
                v-model="selectedCategories"
                :disabled="selectedCategories.length >= 3 && !selectedCategories.includes(cat)"
              />
              <label
                :for="cat"
                :class="{
                  disabled: selectedCategories.length >= 3 && !selectedCategories.includes(cat),
                }"
              >
                {{ cat }}
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="time-and-place">
        <h1>Time and Place</h1>
        <div class="multi-day">
          <input v-model="is_multi_day" type="checkbox" id="multi-day" />
          <label for="multi-day">Multi-day event?</label>
        </div>
        <div class="date-time">
          <div class="date">
            <p v-if="is_multi_day">Start Date</p>
            <input v-model="eventData.date" type="date" placeholder=" " />
          </div>
          <div class="end-date" v-if="is_multi_day">
            <p>End Date</p>
            <input v-model="eventData.end_date" type="date" placeholder=" " />
          </div>
        </div>

        <div
          class="location"
          v-if="eventData.event_format === 'physical' || eventData.event_format === 'hybrid'"
        >
          <input v-model="eventData.location" type="text" placeholder=" " />
          <p>Location</p>
        </div>
        <div class="time">
          <input v-model="eventData.time" type="time" placeholder=" " />
          <p>Time</p>
          <!-- <div class="condition">* Use the format HH:MM AM/PM</div> -->
        </div>
        <div class="event-format">
          <h3>Event Format</h3>
          <div class="event-format-options">
            <div class="">
              <label for="physical">Physical</label>
              <input type="radio" id="physical" value="physical" v-model="eventData.event_format" />
            </div>
            <div class="">
              <label for="virtual">Virtual</label>
              <input type="radio" id="virtual" value="virtual" v-model="eventData.event_format" />
            </div>
            <div class="">
              <label for="hybrid">Hybrid</label>
              <input type="radio" id="hybrid" value="hybrid" v-model="eventData.event_format" />
            </div>
          </div>
          <div
            class="location"
            v-if="eventData.event_format === 'physical' || eventData.event_format === 'hybrid'"
          >
            <input v-model="eventData.location" type="text" placeholder=" " />
            <p>Location</p>
          </div>
          <div
            class="category"
            v-if="eventData.event_format === 'virtual' || eventData.event_format === 'hybrid'"
          >
            <input v-model="eventData.linkToRegister" type="text" placeholder=" " />
            <p>Paste meeting or streaming link (Zoom, Google Meet, etc.)</p>
          </div>
        </div>
      </div>

      <div class="requires-registration">
        <input v-model="eventData.requires_registration" type="checkbox" />
        <p>Requires Registration? {{ eventData.requires_registration }}</p>
      </div>
      <div v-if="eventData.requires_registration" class="amount">
        <p>Capacity</p>
        <div class="amountInput">
          <input
            v-model="eventData.capacity"
            type="text"
            placeholder="Leave empty for unlimited attendance"
          />
        </div>
        <div class="condition">* Use numbers only, no symbols</div>
      </div>

      <div class="event-image">
        <p>Upload Event Flier (Max 3MB)</p>
        <input id="uploadFile" type="file" style="display: none" @change="handleFileUpload" />
        <label for="uploadFile" class="label">
          <DownloadIcon />
          <span>Upload image</span>
        </label>
        <p v-if="loading">Loading...</p>
        <div v-if="eventData.imageUrl" class="imageDisplay">
          <img loading="lazy" :src="eventData.imageUrl" alt="event image" />
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="error">
      {{ errorMessage }}
    </div>

    <div class="save-cancel-btn">
      <button class="cancel">Cancel</button>
      <button class="save" @click="handleSaveEvent">Save</button>
    </div>
  </div>
</template>

<style scoped>
.categoryContainer {
  display: flex;
  gap: 5px;
}
.categoryContainer .cat {
  display: flex;
  gap: 5px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  border-radius: 5px;
}
.error,
.capacity .condition,
.time .condition {
  color: red;
  margin-top: 4px;
}
.capacityValue {
  position: relative;
  position: 100%;
  display: flex;
}
.capacityValue span {
  position: absolute;
  left: 17px;
  top: 17px;
}
.testing {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 24px;
}
.requires-registration {
  display: flex;
  align-items: center;
}
.requires-registration p {
  margin: 7px 0;
}
.capacity input {
  width: 100%;
  outline: none;
  color: #8c8c8b;
  border: 1px solid #dfdfdf;
  height: 54px;
  padding: 0 35px;
  font-size: 16px;
  font-size: 16px;
}
.capacity > p {
  margin-top: 0;
}
.imageDisplay {
  width: 250px;
}
img {
  width: 100%;
}
.label {
  display: flex;
  align-items: center;
}
.create-event-container {
  width: 90%;
  margin: auto;
}
.create-event {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
  margin-top: 30px;
}
.no-of-categories {
  display: flex;
  gap: 10px;
}
.basic-info,
.time-and-place {
  gap: 15px;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 2px solid #0a99fe;
  border-radius: 10px;
}
textarea {
  outline: none;
  resize: none;
}
.nav {
  display: flex;
  align-items: center;
  gap: 5px;
}
.create-event-container a {
  color: #000;
  text-decoration: none;
}
.title,
.time,
.location,
.description,
.category,
.event-image,
.org-email,
.description {
  position: relative;
  display: flex;
}
.title input,
.time input,
.location input,
.category input,
.org-email input,
.category input,
.org-email input {
  width: 100%;
  outline: none;
  color: #8c8c8b;
  border: 1px solid #dfdfdf;
  height: 54px;
  padding: 0 17px;
  font-size: 16px;
  font-size: 16px;
}
.description textarea {
  width: 100%;
  outline: none;
  color: #8c8c8b;
  border: 1px solid #dfdfdf;
  padding: 18px 17px 0;
  font-size: 16px;
}
.title p,
.location p,
.description p,
.time p,
.category p,
.org-email p {
  margin: 0;
  position: absolute;
  top: 17px;
  left: 17px;
  font-size: 16px;
  transition: top 0.1s ease;
}
.title input:focus + p,
.title input:not(:placeholder-shown) + p,
.location input:focus + p,
.location input:not(:placeholder-shown) + p,
.description textarea:focus + p,
.description textarea:not(:placeholder-shown) + p,
.time input:focus + p,
.time input:not(:placeholder-shown) + p,
.category input:focus + p,
.category input:not(:placeholder-shown) + p,
.org-email input:focus + p,
.org-email input:not(:placeholder-shown) + p {
  top: -9px;
  background-color: #fff;
}
.event-format {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
  gap: 10px;
}
.event-format h3,
.event-format p {
  margin: 0;
}
.event-format-options {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}
.date-time {
  display: flex;
  width: 100%;
  gap: 1rem;
}
.date,
.time,
.end-date {
  flex: 1;
  width: 100%;
}
.time input {
  width: auto;
}
.time {
  flex-direction: column;
  height: 100%;
}
.date input,
.end-date input {
  width: 100%;
  height: 54px;
  border: 1px solid #dfdfdf;
  /* padding: 0 17px; */
}
.save-cancel-btn {
  margin: 40px 0 40px auto;
  display: flex;
  width: 30%;
  justify-content: flex-end;
  gap: 10px;
}
.save-cancel-btn button {
  padding: 15px 10px;
  border-radius: 5px;
  flex: 1;
  cursor: pointer;
  border: none;
}
.save-cancel-btn .save {
  background-color: #0a99fe;
  color: #fff;
}
.event-image {
  flex-direction: column;
  background-color: #f0f0f0;
  padding: 40px;
  justify-content: center;
  border-radius: 7px;
  align-items: center;
}
@media screen and (max-width: 500px) {
  .nav h2 {
    margin: 0;
  }
  .date {
    display: flex;
  }
  .time {
    display: flex;
  }
  .time input {
    display: flex;
    width: auto;
  }
  .date-time {
    flex-direction: column;
    width: 100%;
  }
  .categoryContainer {
    overflow: auto;
  }
  .save-cancel-btn {
    margin-bottom: 120px;
    width: 100%;
  }
}
</style>
