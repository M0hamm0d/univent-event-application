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
    const requestData = request.value.find((r) => r.id === id)

    if (!requestData) {
      alert('No request data found')
      return
    }

    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('event_title', requestData.event_title)
      .eq('location', requestData.location)

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
            email: requestData.user_email,
          }),
        })
        if (!res.ok) {
          throw new Error('Failed to send duplicate email')
        }
        toast.success('Duplicate email sent successfully')
        request.value = request.value.filter((r) => r.id !== id)
        const { error: deleteError } = await supabase.from('requested-event').delete().eq('id', id)
        if (deleteError) {
          console.error('Error deleting request:', deleteError)
        } else {
          console.log('Request deleted successfully')
        }
        return
      } catch (emailError) {
        console.error('Error sending duplicate email:', emailError)
        toast.error('Failed to send duplicate email')
        return
      }
    }

    const result = await pushToEvents(requestData)

    if (result.success) {
      eventValue.value.push(...result.data)

      request.value = request.value.filter((r) => r.id !== id)
      toast.success('Event approved successfully')
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
