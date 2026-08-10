<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useToast } from 'vue-toastification'

const route = useRoute()
const router = useRouter()
const univentStore = useUniventStore()
const toast = useToast()

const eventId = route.params.eventId
const event = ref(null)
const registered = ref([])
const waitlisted = ref([])
const loading = ref(true)

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
  } catch (err) {
    console.error('Unexpected error:', err)
    toast.error('An unexpected error occurred')
  } finally {
    loading.value = false
  }
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
            <div class="position">#{{ i + 1 }}</div>
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
            <div class="position">Position {{ i + 1 }}</div>
          </div>
        </div>
      </div>
    </div>
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
}
</style>