<script setup>
import { ref, onMounted, toRaw } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/supabase'
import { useUniventStore } from '@/stores/counter'
import { useToast } from 'vue-toastification'

const route = useRoute()
const univentStore = useUniventStore()
const toast = useToast()

const eventData = ref(null)
const attendees = ref([])
const loading = ref(true)
const eventId = route.params.eventId

async function fetchEventAttendees() {
  try {
    loading.value = true

    const { data: createdEventData, error } = await supabase
      .from('events')
      .select(
        `
        *,
        registered_events(
          id,
          user_id,
          profile (
            id,
            user_name,
            profile_pics,
            user_email
          )
        )
      `,
      )
      .eq('created_by', univentStore.userProfile.id)
      .eq('id', eventId)
      .single()

    console.log(toRaw(createdEventData))

    if (error) {
      console.error('Error fetching event attendees:', error)
      toast.error('Failed to load attendees')
      return
    }

    eventData.value = createdEventData
    attendees.value = createdEventData.registered_events || []
  } catch (err) {
    console.error('Unexpected error:', err)
    toast.error('An unexpected error occurred')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchEventAttendees()
})
</script>

<template>
  <div class="manage-attendees-container">
    <div class="header">
      <h1>Manage Attendees</h1>
      <p v-if="eventData">{{ eventData.event_title }}</p>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading attendees...</p>
    </div>

    <div v-else-if="!eventData" class="error">
      <p>Event not found or you don't have permission to view this event.</p>
    </div>

    <div v-else class="content">
      <div class="event-info">
        <h2>{{ eventData.event_title }}</h2>
        <div class="stats">
          <div class="stat">
            <span class="label">Total Attendees:</span>
            <span class="value">{{ attendees.length }}</span>
          </div>
          <div class="stat">
            <span class="label">Event Date:</span>
            <span class="value">{{ new Date(eventData.date).toLocaleDateString() }}</span>
          </div>
        </div>
      </div>

      <div class="attendees-section">
        <h3>Registered Attendees</h3>

        <div v-if="attendees.length === 0" class="no-attendees">
          <p>No attendees registered yet.</p>
        </div>

        <div v-else class="attendees-list">
          <div v-for="attendee in attendees" :key="attendee.id" class="attendee-card">
            <div class="attendee-info">
              <div class="avatar">
                <img
                  v-if="attendee.profile?.profile_pics"
                  :src="attendee.profile.profile_pics"
                  :alt="attendee.profile?.user_name || 'User'"
                />
                <div v-else class="default-avatar">
                  {{ (attendee.profile?.user_name || 'U')[0].toUpperCase() }}
                </div>
              </div>
              <div class="details">
                <h4>{{ attendee.profile?.user_name || 'Unknown User' }}</h4>
                <p>{{ attendee.profile?.user_email || 'No email' }}</p>
              </div>
            </div>
            <div class="actions">
              <button class="btn-contact">Contact</button>
            </div>
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
  margin: 5px 0 0 0;
  color: #666;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 10px;
}

.btn-contact {
  padding: 8px 16px;
  background: #1969fe;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-contact:hover {
  background: #1456cc;
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

  .actions {
    width: 100%;
  }

  .btn-contact {
    width: 100%;
  }
}
</style>
