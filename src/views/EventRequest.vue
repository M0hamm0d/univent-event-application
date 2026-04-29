<script setup>
import { ref, onMounted, toRaw } from 'vue'
import { useRequestedEvents } from '@/composables/useRequestedEvents'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

const { fetchRequestedAndEvents, pushToEvents } = useRequestedEvents()
const toast = useToast()

const request = ref([])
const requestData = ref([])
const eventValue = ref([])
const loading = ref(false)

async function handlePushToEvent(id) {
  try {
    loading.value = true
    requestData.value = request.value.find((r) => r.id === id)
    const eventDate = new Date(requestData.value.date)
    const today = new Date()
    if (eventDate < today) {
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
    const { user_id, user_email, ...rest } = requestData.value
    const eventData = {
      ...rest,
      created_by: user_id,
      email: user_email,
    }
    console.log(eventData)

    const result = await pushToEvents(eventData)

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

const rejectionReasons = ref('')
const showRejectInput = ref(null)

async function handleReject(req) {
  try {
    if (!rejectionReasons.value.trim()) {
      toast.error('Please enter a reason')
      return
    }

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

    const { error } = await supabase.from('requested-event').delete().eq('id', req.id)

    if (error) {
      console.error('Delete error:', error)
    }

    showRejectInput.value = null
    rejectionReasons.value = ''
  } catch (err) {
    console.error(err)
    toast.error('Failed to send rejection email')
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
<template>
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
