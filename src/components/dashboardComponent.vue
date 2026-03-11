<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import EventsCard from './EventsCard.vue'

const univentStore = useUniventStore()

const registeredEvents = ref([])
const interestedEvents = ref([])
const createdEvents = ref([])
const trendingEvents = ref([])
const sharedCount = ref(0)
const loadingUserData = ref(false)

// upcoming = registered events whose date is in future
const upcomingEvents = computed(() => {
  const now = new Date()
  return registeredEvents.value.filter((e) => new Date(e.date) >= now)
})

const totalCreatedEvents = computed(() => {
  return createdEvents.value.length
})

const totalSharedEvents = computed(() => {
  return sharedCount.value
})

const hasAnyEvents = computed(() => {
  return (
    registeredEvents.value.length || interestedEvents.value.length || trendingEvents.value.length
  )
})

const displayName = computed(() => {
  return univentStore.userProfile?.user_name || univentStore.userProfile?.user_email || 'User'
})

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
      <div class="section" v-if="createdEvents.length">
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
            <button disabled="true" class="analytics-button">View Analytics</button>
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
}
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
