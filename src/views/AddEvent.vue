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
  email: '',
  imageUrl: '',
  price: '',
  isPaid: false,
  linkToRegister: '',
  isInterested: false,
  requires_registration: false,
})

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
  // if (!/^\d{2}:\d{2}\s?(AM|PM)$/i.test(eventData.value.time)) {
  //   errorMessage.value = 'Invalid time format. Use HH:MM AM/PM'
  //   setTimeout(() => {
  //     errorMessage.value = ''
  //   }, 4000)
  //   return
  // }
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

  if (eventData.value.isPaid) {
    if (!/^\d+$/.test(eventData.value.price)) {
      errorMessage.value = 'Invalid price format'
      setTimeout(() => {
        errorMessage.value = ''
      }, 4000)
      return
    }
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
    time: '',
    location: '',
    categories: [],
    // email: '',
    imageUrl: '',
    price: '',
    isPaid: false,
    linkToRegister: '',
    isInterested: false,
  }
  selectedCategories.value = []
  currentFileName.value = ''
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
        <div class="date-time">
          <div class="date">
            <input v-model="eventData.date" type="date" placeholder=" " />
          </div>
          <div class="time">
            <input v-model="eventData.time" type="time" placeholder=" " />
            <p>Time</p>
            <!-- <div class="condition">* Use the format HH:MM AM/PM</div> -->
          </div>
        </div>

        <div class="location">
          <input v-model="eventData.location" type="text" placeholder=" " />
          <p>Location</p>
        </div>
      </div>

      <div class="price">
        <input v-model="eventData.isPaid" type="checkbox" />
        <p>Paid? {{ eventData.isPaid }}</p>
      </div>

      <div v-if="eventData.isPaid" class="amount">
        <p>Amount</p>
        <div class="amountInput">
          <span>₦</span>
          <input v-model="eventData.price" type="text" placeholder="Enter Ticket Amount" />
        </div>
        <div class="condition">* Use numbers only, no symbols</div>
      </div>

      <div class="category">
        <input v-model="eventData.linkToRegister" type="text" placeholder=" " />
        <p>Link to register</p>
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

      <!-- <div class="org-email">
        <input v-model="eventData.email" type="text" placeholder=" " />
        <p>Organizer Email</p>
      </div> -->
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
.amount .condition,
.time .condition {
  color: red;
}
.amountInput {
  position: relative;
  position: 100%;
  display: flex;
}
.amountInput span {
  position: absolute;
  left: 17px;
  top: 17px;
}
.testing {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 24px;
}
.price {
  display: flex;
  align-items: center;
}
.amount input {
  width: 100%;
  outline: none;
  color: #8c8c8b;
  border: 1px solid #dfdfdf;
  height: 54px;
  padding: 0 35px;
  font-size: 16px;
  font-size: 16px;
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
.date-time {
  display: flex;
  width: 100%;
  gap: 3rem;
}
.date,
.time {
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
.date input {
  width: 100%;
  height: 54px;
  border: 1px solid #dfdfdf;
  padding: 0 17px;
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
