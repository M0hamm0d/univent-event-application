<script setup>
import { ref, onMounted } from 'vue'
import { useRequestedEvents } from '@/composables/useRequestedEvents'

const { fetchRequestedAndEvents, pushToEvents } = useRequestedEvents()

const request = ref([])
const eventValue = ref([])
const loading = ref(false)

async function handlePushToEvent(id) {
  const data = request.value.find((r) => r.id === id)
  if (!data) {
    alert('There is no data')
    return
  }

  const result = await pushToEvents(data)
  if (result.success) {
    eventValue.value.push(...result.data)
    request.value = request.value.filter((r) => r.id !== id)
    console.log('Successfully pushed to events')
  } else {
    console.error(result.error)
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
