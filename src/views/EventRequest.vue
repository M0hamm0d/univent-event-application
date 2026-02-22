<script setup>
import { ref, onMounted } from 'vue'
import { useRequestedEvents } from '@/composables/useRequestedEvents'
import { supabase } from '@/supabase'

const { fetchRequestedAndEvents, pushToEvents } = useRequestedEvents()

const request = ref([])
const eventValue = ref([])
const loading = ref(false)

// async function handlePushToEvent(id) {
//   const data = request.value.find((r) => r.id === id)
//   if (!data) {
//     alert('There is no data')
//     return
//   }

//   let { data: events, error } = await supabase
//     .from('events')
//     .select('*')
//     .eq('event_title', data.event_title)
//     .eq('location', data.location)

//   // console.log(events, 'This is data', data.event_title, data.description)

//   if (events && events.length >= 1) {
//     console.log('Hmmm, i think this is a duplicated event')
//     // await fetch('/api/duplicate-event', {
//     //   method: 'POST',
//     //   headers: {
//     //     'Content-Type': 'application/json',
//     //   },
//     //   body: JSON.stringify({
//     //     email: data.user_email,
//     //     name: data.user_name,
//     //   }),
//     // })
//     await fetch('https://ezpifvuigyedcqiofgrf.supabase.co/functions/v1/duplicate-event', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         to: data.user_email,
//         subject: 'Duplicate Event Notification',
//         text: `Hello ${data.user_name}, \n\n Thank you for submitting your event to our platform. \n\n We noticed that the event you recently added appears to have already been submitted by another organizer earlier. To avoid duplicate listings and ensure the best experience for users, we were unable to publish your submission at this time. \n\n If you believe this was flagged in error or you have additional information to provide (such as a different session, update, or collaboration with the original organizer), please feel free to reply to this email and we will be happy to review it. \n\n We appreciate your understanding and your effort in sharing events with the community. \n\n Best regards, \n The UniVent Team`,
//       }),
//     })
//     console.log('email successfully sent')
//     return
//   } else if (error) {
//     console.log('error in fetching events')
//   }

//   // const result = await pushToEvents(data)
//   // if (result.success) {
//   //   eventValue.value.push(...result.data)
//   //   request.value = request.value.filter((r) => r.id !== id)
//   //   console.log('Successfully pushed to events')
//   // } else {
//   //   console.error(result.error)
//   // }
// }

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

    if (fetchError) {
      console.error('Error checking events:', fetchError)
      return
    }

    // Duplicate event detected
    if (events && events.length > 0) {
      console.log('Duplicate event detected')

      const { data, error } = await supabase.functions.invoke('duplicate-event', {
        body: {
          to: requestData.user_email,
          subject: 'Duplicate Event Notification',
          text: `Hello ${requestData.user_name},

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
        console.log('Duplicate email sent successfully:', data)
      }
      request.value = request.value.filter((r) => r.id !== id)
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
