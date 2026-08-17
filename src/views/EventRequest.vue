<script setup>
import { ref, onMounted, toRaw } from 'vue'
import { useRequestedEvents } from '@/composables/useRequestedEvents'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import BaseButton from '@/components/BaseButton.vue'

const { fetchRequestedAndEvents } = useRequestedEvents()
const toast = useToast()

const request = ref([])
const requestData = ref([])
const loading = ref(false)

async function handlePushToEvent(id) {
  try {
    loading.value = true
    requestData.value = request.value.find((r) => r.id === id)
    const eventDate = new Date(requestData.value.date)
    const today = new Date()
    if (requestData.value.date !== null && eventDate < today) {
      toast.error('Cannot approve past events')
      return
    }

    if (!requestData.value) {
      alert('No request data found')
      return
    }

    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('event_title', requestData.value.event_title)
      .eq('location', requestData.value.location)
      .eq('event_state', 'accepted')

    if (fetchError) {
      console.error('Error checking events:', fetchError)
      return
    }

    if (events && events.length > 0) {
      try {
        const res = await fetch('/api/send-duplicate-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: requestData.value.user_email,
          }),
        })
        if (!res.ok) {
          throw new Error('Failed to send duplicate email')
        }
        toast.success('Duplicate email sent successfully')
        request.value = request.value.filter((r) => r.id !== id)

        const { error: updateError } = await supabase
          .from('events')
          .update({ event_state: 'rejected' })
          .eq('id', id)

        // const { error: deleteError } = await supabase.from('requested-event').delete().eq('id', id)
        if (updateError) {
          console.error('Error updating event:', updateError)
        } else {
          console.log('Event updated successfully')
        }
        return
      } catch (emailError) {
        console.error('Error sending duplicate email:', emailError)
        toast.error('Failed to send duplicate email')
        return
      }
    }
    const { error: updateError } = await supabase
      .from('events')
      .update({ event_state: 'accepted' })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating event:', updateError)
      return
    }
    request.value = request.value.filter((r) => r.id !== id)
    toast.success('Event approved successfully')
    try {
      await fetch('/api/send-review-success', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: requestData.value.user_email,
          event: requestData.value.event_title,
        }),
      })
    } catch (emailError) {
      console.error('Error sending review success email:', emailError)
      toast.error('Failed to send review success email')
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  } finally {
    loading.value = false
  }
}

const rejectionReasons = ref('')
const showRejectInput = ref(null)

async function handleReject(req) {
  try {
    if (!rejectionReasons.value.trim()) {
      toast.error('Please enter a reason')
      return
    }

    loading.value = true
    const res = await fetch('/api/send-rejection-reason', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: req.user_email,
        rejectionReason: rejectionReasons.value,
      }),
    })

    if (!res.ok) {
      throw new Error('Failed to send rejection email')
    }

    toast.success('Rejection email sent successfully')

    request.value = request.value.filter((r) => r.id !== req.id)

    const { error: updateError } = await supabase
      .from('events')
      .update({ event_state: 'rejected' })
      .eq('id', req.id)

    // const { error } = await supabase.from('requested-event').delete().eq('id', req.id)

    if (updateError) {
      console.error('Update error:', updateError)
    }

    showRejectInput.value = null
    rejectionReasons.value = ''
  } catch (err) {
    console.error(err)
    toast.error('Failed to send rejection email')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  const result = await fetchRequestedAndEvents()
  if (result.success) {
    request.value = result.requested_event
    console.log('request value from event request', toRaw(request.value))
  } else {
    console.error(result.error)
  }
  loading.value = false
})
</script>
<!-- <template>
  <div class="">
    <h1>Event Requests</h1>
    <div class="">
      <div v-if="loading" class="loading">Loading...</div>
      <div v-for="(req, i) in request" :key="i">
        <div class="">{{ req }}</div>
        <div class="button">
          <button @click="handlePushToEvent(req.id)">Accept</button>
          <button @click="showRejectInput = req.id">Reject</button>
        </div>
        <div class="" v-if="showRejectInput === req.id">
          <input v-model="rejectionReasons" placeholder="Enter reason for rejection" />
          <button @click="handleReject(req)">Send</button>
        </div>
      </div>
      <div class="">{{ requestData.value }}</div>
    </div>
  </div>
</template> -->
<template>
  <div class="admin-container">
    <header class="header">
      <h1>Event Requests</h1>
      <span v-if="request.length" class="badge">{{ request.length }} Pending</span>
    </header>

    <div class="content">
      <div v-if="loading" class="loader-container">
        <div class="spinner"></div>
        <p>Fetching requests...</p>
      </div>

      <div v-else-if="request.length === 0" class="empty-state">
        <p>No pending event requests. Grab a coffee! ☕</p>
      </div>

      <div v-else class="request-grid">
        <div v-for="req in request" :key="req.id" class="request-card">
          <!-- Event Image -->
          <div class="card-image">
            <img
              :src="req.image_url || 'https://via.placeholder.com/300x150?text=No+Image'"
              alt="Event Flyer"
            />
            <div class="category-tags">
              <span v-for="cat in req.category" :key="cat" class="tag">{{ cat }}</span>
            </div>
          </div>

          <!-- Event Details -->
          <div class="card-body">
            <div class="card-header">
              <h3>{{ req.event_title }}</h3>
              <span class="event-date"
                >{{
                  !!req.date ? new Date(req.date).toLocaleDateString() : 'Date to be announced soon'
                }}
              </span>
            </div>

            <p class="location">📍 {{ req.location }}</p>
            <p class="description">{{ req.description }}</p>

            <!-- Action Buttons -->
            <div class="actions" v-if="showRejectInput !== req.id">
              <BaseButton
                variant="success"
                size="sm"
                :loading="loading"
                @click="handlePushToEvent(req.id)"
              >
                Approve
              </BaseButton>
              <BaseButton
                variant="soft-danger"
                size="sm"
                :loading="loading"
                @click="showRejectInput = req.id"
              >
                Reject
              </BaseButton>
            </div>

            <!-- Rejection UI -->
            <div class="rejection-box" v-if="showRejectInput === req.id">
              <textarea
                v-model="rejectionReasons"
                placeholder="Why is this being rejected?"
                rows="3"
              ></textarea>
              <div class="rejection-actions">
                <BaseButton
                  variant="danger"
                  size="sm"
                  :loading="loading"
                  @click="handleReject(req)"
                >
                  Send Rejection
                </BaseButton>
                <button @click="showRejectInput = null" class="btn-cancel">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<!-- <style scoped>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}
</style> -->
<style scoped>
.admin-container {
  max-width: 1000px;
  margin: 2rem auto;
  padding: 0 1rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.badge {
  background: #e0e7ff;
  color: #4338ca;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.request-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.request-card {
  display: grid;
  grid-template-columns: 250px 1fr;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  border: 1px solid #f3f4f6;
}

.card-image {
  position: relative;
  height: 100%;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-tags {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
}

.tag {
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #111827;
}

.event-date {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.location {
  font-size: 0.9rem;
  color: #4b5563;
  margin-bottom: 1rem;
}

.description {
  font-size: 0.875rem;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: auto;
}

button {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.rejection-box {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed #e5e7eb;
}

textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
}

.rejection-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-cancel {
  background: #9ca3af;
  color: white;
  font-size: 0.875rem;
}

.loader-container {
  text-align: center;
  padding: 3rem;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4338ca;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .request-card {
    grid-template-columns: 1fr;
  }
  .card-image {
    height: 180px;
  }
}
</style>
