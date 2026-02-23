<script setup>
import { ref, onMounted } from 'vue'
import { useRequestedEvents } from '@/composables/useRequestedEvents'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

const { fetchRequestedAndEvents, pushToEvents } = useRequestedEvents()
const toast = useToast()

const request = ref([])
const eventValue = ref([])
const loading = ref(false)

async function handlePushToEvent(id) {
  try {
    loading.value = true

    // Find request data
    const requestData = request.value.find((r) => r.id === id)

    if (!requestData) {
      alert('No request data found')
      return
    }

    // Check if event already exists
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('event_title', requestData.event_title)
      .eq('location', requestData.location)
    console.log(events, 'events data')

    if (fetchError) {
      console.error('Error checking events:', fetchError)
      return
    }

    if (events && events.length > 0) {
      console.log('Duplicate event detected')

      const { data, error } = await supabase.functions.invoke('duplicate-event', {
        body: {
          to: requestData.user_email,
          subject: 'Duplicate Event Notification',
          text: `Hello,

      Thank you for submitting your event to our platform.

      We noticed that the event you recently added appears to have already been submitted by another organizer earlier. To avoid duplicate listings and ensure the best experience for users, we were unable to publish your submission at this time.

      If you believe this was flagged in error or you have additional information to provide (such as a different session, update, or collaboration with the original organizer), please feel free to reply to this email and we will be happy to review it.

      We appreciate your understanding and your effort in sharing events with the community.

      Best regards,
      The UniVent Team`,
        },
      })

      if (error) {
        console.error('Email send error:', error)
      } else {
        toast.success('Duplicate email sent successfully')
        console.log('Duplicate email sent successfully:', data)
      }
      request.value = request.value.filter((r) => r.id !== id)
      const { error: deleteError } = await supabase.from('requested-event').delete().eq('id', id)
      if (deleteError) {
        console.error('Error deleting request:', deleteError)
      } else {
        console.log('Request deleted successfully')
      }
      return
    }

    const result = await pushToEvents(requestData)

    if (result.success) {
      eventValue.value.push(...result.data)

      request.value = request.value.filter((r) => r.id !== id)

      console.log('Event successfully approved')
    } else {
      console.error('Push error:', result.error)
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  const result = await fetchRequestedAndEvents()
  if (result.success) {
    request.value = result.requested_event
  } else {
    console.error(result.error)
  }
  loading.value = false
})
</script>
<template>
  <div class="">
    <h1>Event Requests</h1>
    <div class="">
      <div v-if="loading" class="loading">Loading...</div>
      <div v-for="(req, i) in request" :key="i">
        <div class="">{{ req }}</div>
        <div class="button">
          <button @click="handlePushToEvent(req.id)">Accept</button>
          <button>Reject</button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}
</style>
