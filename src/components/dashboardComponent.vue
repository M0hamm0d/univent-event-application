<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useToast } from 'vue-toastification'
import EventsCard from './EventsCard.vue'

const univentStore = useUniventStore()
const toast = useToast()

const registeredEvents = ref([])
const interestedEvents = ref([])
const createdEvents = ref([])
const trendingEvents = ref([])
const showModal = ref(false)
// const sharedCount = ref(0)
const loadingUserData = ref(false)
import { useRouter } from 'vue-router'
const router = useRouter()
const loading = ref(false)

const eventToDelete = ref(null)

// upcoming = registered events whose date is in future
const upcomingEvents = computed(() => {
  const now = new Date()
  return registeredEvents.value.filter((e) => new Date(e.date) >= now)
})

const totalCreatedEvents = computed(() => {
  return createdEvents.value.length
})

// const totalSharedEvents = computed(() => {
//   return sharedCount.value
// })

const hasAnyEvents = computed(() => {
  return (
    registeredEvents.value.length || interestedEvents.value.length || trendingEvents.value.length
  )
})

const displayName = computed(() => {
  return univentStore.userProfile?.user_name || univentStore.userProfile?.user_email || 'User'
})

function editEvent(event) {
  router.push({
    path: '/add-event',
    query: { id: event.id },
  })
}

async function fetchRegistered() {
  if (!univentStore.userProfile?.id) return
  const { data, error } = await supabase
    .from('registered_events')
    .select('events(*)')
    .eq('user_id', univentStore.userProfile.id)
  if (error) {
    console.error('fetchRegistered', error.message)
    return
  }
  registeredEvents.value = data.map((r) => r.events)
}

function cancel() {
  eventToDelete.value = null
  showModal.value = false
}

async function fetchCreatedEvents() {
  if (!univentStore.userProfile?.id) return

  const { data, error } = await supabase
    .from('events')
    .select(
      `
      *,
      registered_events(count)
    `,
    )
    .eq('created_by', univentStore.userProfile.id)

  if (error) {
    console.error('fetchCreatedEvents', error.message)
    return
  }

  createdEvents.value = data
}

async function fetchInterested() {
  if (!univentStore.userProfile?.id) return
  const { data, error } = await supabase
    .from('interested_events')
    .select('events(*)')
    .eq('user_id', univentStore.userProfile.id)
  if (error) {
    console.error('fetchInterested', error.message)
    return
  }
  //.select('event(*)')
  interestedEvents.value = data.map((r) => r.events)
}

async function fetchTrending() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('interested_students', { ascending: false })
    .limit(6)
  if (error) {
    console.error('fetchTrending', error.message)
    return
  }
  trendingEvents.value = data
}

function openModal(event) {
  eventToDelete.value = event
  showModal.value = true
}

async function deleteConfirmed() {
  loading.value = true
  console.log(eventToDelete.value)
  try {
    const { error } = await supabase.from('events').delete().eq('id', eventToDelete.value.id)
    if (error) {
      console.error('Error deleting event:', error.message)
      alert('Failed to delete event. Please try again.')
    } else {
      toast.success('Event deleted successfully')
      await fetchCreatedEvents()
      cancel()
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    toast.error('An unexpected error occurred. Please try again.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (univentStore.isAuthenticated) {
    loadingUserData.value = true
    await Promise.all([fetchRegistered(), fetchInterested(), fetchCreatedEvents()])
    loadingUserData.value = false
  }
  fetchTrending()
})

// re-fetch when authentication state changes
watch(
  () => univentStore.isAuthenticated,
  async (val) => {
    if (val) {
      await Promise.all([fetchRegistered(), fetchInterested(), fetchCreatedEvents()])
    } else {
      registeredEvents.value = []
      interestedEvents.value = []
      createdEvents.value = []
    }
  },
)
</script>
<template>
  <div v-if="showModal" class="modal-overlay" @click="cancel">
    <div class="modal-card" @click.stop>
      <div class="icon-container">
        <div class="icon-circle">
          <span class="icon-inner">!</span>
        </div>
      </div>

      <div class="modal-body">
        <h2>Delete Event?</h2>

        <p class="main-text">Are you sure you want to delete this event?</p>

        <p class="sub-text">
          This action cannot be undone. The event and all associated data (views, shares,
          registrations) will be permanently removed.
        </p>

        <div class="modal-actions">
          <button class="btn-outline" @click="cancel">Cancel</button>
          <button class="btn-confirm" @click="deleteConfirmed" :disabled="loading">
            {{ loading ? 'Processing...' : 'Yes, I Agree' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div class="dashboard-container">
    <div class="header">
      <h2>Welcome back, {{ displayName.split(' ')[0] }}</h2>
      <p class="subtext">Here’s a quick look at your UniVent activity</p>
    </div>

    <!-- stats row -->
    <div class="stats-grid">
      <template v-if="loadingUserData">
        <div class="stat-card placeholder"></div>
        <div class="stat-card placeholder"></div>
        <div class="stat-card placeholder"></div>
      </template>
      <template v-else>
        <div class="stat-card">
          <div class="stat-count">{{ registeredEvents.length }}</div>
          <div class="stat-label">Registered</div>
        </div>
        <div class="stat-card">
          <div class="stat-count">{{ interestedEvents.length }}</div>
          <div class="stat-label">Interested</div>
        </div>
        <div class="stat-card">
          <div class="stat-count">{{ upcomingEvents.length }}</div>
          <div class="stat-label">Upcoming</div>
        </div>
        <div class="stat-card">
          <div class="stat-count">{{ totalCreatedEvents }}</div>
          <div class="stat-label">Events Created</div>
        </div>
      </template>
    </div>

    <!-- sections for event lists -->
    <div class="section-container">
      <!-- <div class="section" v-if="createdEvents.length">
        <h3>Your Created Events</h3>

        <div class="event-row-container">
          <div v-for="event in createdEvents" :key="event.id" class="event-row">
            <h4>{{ event.event_title }}</h4>

            <p v-if="event.requires_registration">
              Registrations:
              {{ event.registered_events?.[0]?.count || 0 }}
            </p>

            <p v-else>Not Registrable</p>

            <p>Shared: {{ event.shared_count || 0 }}</p>
            <p>Viewed: {{ event.viewed_count || 0 }}</p>
            <div class="">
              <button class="edit-btn" @click="() => editEvent(event)">Edit</button>
              <button class="delete-btn">Delete</button>
            </div>
          </div>
        </div>
      </div> -->
      <div class="events-section" v-if="createdEvents.length">
        <header class="section-header">
          <h3 class="section-title">Your Created Events</h3>
          <span class="event-count">{{ createdEvents.length }} Events</span>
        </header>

        <div class="event-grid">
          <div v-for="event in createdEvents" :key="event.id" class="event-card">
            <div class="card-content">
              <div class="card-main">
                <h4 class="event-name">{{ event.event_title }}</h4>

                <!-- Status Badge -->
                <span :class="['badge', event.requires_registration ? 'badge-blue' : 'badge-gray']">
                  {{ event.requires_registration ? 'Registrable' : 'Open Entry' }}
                </span>
              </div>

              <!-- Metrics Row -->
              <div class="stats-container">
                <div class="stat-item" v-if="event.requires_registration">
                  <span class="stat-label">Registrations</span>
                  <span class="stat-value">{{ event.registered_events?.[0]?.count || 0 }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Shares</span>
                  <span class="stat-value">{{ event.shared_count || 0 }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Views</span>
                  <span class="stat-value">{{ event.viewed_count || 0 }}</span>
                </div>
              </div>
            </div>

            <!-- Action Footer -->
            <div class="card-actions">
              <button class="btn btn-outline" @click="editEvent(event)">Edit</button>
              <button class="btn btn-danger" @click="openModal(event)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section" v-if="trendingEvents.length">
        <h3>Trending on UniVent</h3>
        <div class="card-container">
          <EventsCard :events="trendingEvents" />
        </div>
      </div>
    </div>

    <div class="empty-state" v-if="!hasAnyEvents">
      <p>Nothing to show yet. Start exploring events and mark your favourites!</p>
      <router-link to="/discover" class="explore-link">Browse events</router-link>
    </div>
  </div>
</template>

<style scoped>
/* modal begins here */
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

/* The White Card */
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

/* Icon Styling */
.icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.icon-circle {
  width: 60px;
  height: 60px;
  background: #ffe5e5; /* Soft blue tint */
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
  background: #ffe5e5;
  opacity: 0.4;
}
.icon-inner {
  color: red;
  font-size: 24px;
  font-weight: bold;
  border: 2px solid red;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* Typography */
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

/* Action Buttons */
.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.single-btn {
  grid-template-columns: 1fr;
}

.modal-overlay button {
  padding: 14px 20px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-outline {
  background: transparent;
  border: 1.5px solid #e2e8f0;
  color: #64748b;
}
.btn-outline:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-confirm,
.btn-primary {
  background: transparent;
  border: 1.5px solid red;
  color: red;
}
.btn-confirm:hover,
.btn-primary:hover {
  background: red;
  color: #ffffff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .modal-card {
    padding: 30px 20px 20px 20px;
  }
  .modal-actions {
    grid-template-columns: 1fr; /* Stack buttons on mobile */
  }
}
/* modal ends here */
button {
  font-family: Satoshi;
}
.dashboard-container {
  max-width: 960px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: 'Poppins', sans-serif;
}
.header h2 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
}
.subtext {
  color: #555;
  margin-top: 4px;
}
.stats-grid {
  display: flex;
  justify-content: space-between;
  margin: 24px 0;
  flex-wrap: wrap;
  gap: 16px;
}
.stat-card {
  flex: 1 1 30%;
  background: #fff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  text-align: center;
}
.stat-card.placeholder {
  min-height: 80px;
  background: #f0f0f0;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    opacity: 1;
  }
}
.stat-count {
  font-size: 2rem;
  font-weight: 700;
  color: #333;
}
.stat-label {
  margin-top: 4px;
  color: #777;
  font-size: 0.9rem;
}
.section-container {
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.section {
  margin-top: 32px;
}
/* section */
/* Container & Header */
.events-section {
  margin: 40px 0;
  padding: 0 16px;
  max-width: 1200px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1b;
  margin: 0;
}

.event-count {
  background: #f0f2f5;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #5f6368;
}

/* Grid Layout */
.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

/* Card Styling */
.event-card {
  background: #ffffff;
  border: 1px solid #eef0f2;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  overflow: hidden;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.card-content {
  padding: 20px;
  flex-grow: 1;
}

.event-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: #111;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

/* Badges */
.badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}
.badge-blue {
  background: #e3f2fd;
  color: #1976d2;
}
.badge-gray {
  background: #f5f5f5;
  color: #616161;
}

/* Stats Visualization */
.stats-container {
  display: flex;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f8f9fa;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.75rem;
  color: #70757a;
  margin-bottom: 2px;
}

.stat-value {
  font-weight: 700;
  color: #202124;
  font-size: 1rem;
}

/* Buttons */
.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: #eef0f2; /* Creates a thin border between buttons */
  border-top: 1px solid #eef0f2;
}

.btn {
  border: none;
  background: white;
  padding: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-outline:hover {
  background: #f8f9fa;
  color: #2563eb;
}
.btn-danger:hover {
  background: #fff5f5;
  color: #dc2626;
}

/* Mobile Adjustments */
@media (max-width: 480px) {
  .event-grid {
    grid-template-columns: 1fr;
  }

  .section-title {
    font-size: 1.25rem;
  }

  .stats-container {
    justify-content: space-between;
  }
}
/* .section {
  margin-top: 32px;
}
.section h3 {
  font-size: 1.4rem;
  margin-bottom: 12px;
  color: #222;
}
.event-row-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}
.event-row {
  background: white;
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
} */
.analytics-button {
  margin-top: 8px;
  padding: 9px 12px;
  width: 100%;
  background-color: #007aff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: not-allowed;
  font-size: 16px;
  font-family: Satoshi;
}
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}
.empty-state {
  text-align: center;
  margin: 40px 0;
  color: #666;
}
.empty-state .explore-link {
  display: inline-block;
  margin-top: 12px;
  text-decoration: none;
  color: #007aff;
  font-weight: 600;
}
@media screen and (max-width: 600px) {
  .stat-card {
    flex: 1 1 100%;
  }
}
</style>
