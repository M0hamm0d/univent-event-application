<script setup>
import EventSearchHeader from '@/components/EventSearchHeader.vue'
import EventsCard from '@/components/EventsCard.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { onMounted, ref, watch } from 'vue'
import { useEventFilters } from '@/composables/useEventFilters'
import { useRequestedEvents } from '@/composables/useRequestedEvents'
import { useUniventStore } from '@/stores/counter'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { filter, loading, noEvent, filterUpcomingEventOnlyAndInterested } = useEventFilters()
const { fetchRequestedAndEvents } = useRequestedEvents()
const univentStore = useUniventStore()
const pagesNo = ref(false)
const emptyEvent = ref(false)
const resultNo = ref(null)
const unavailableEvent = ref(false)
const count = ref(null)
const searchFromId = ref([])
const isFilterActive = ref(false)

async function fetchInterestedEvents() {
  try {
    // let { data: interested_events, error } = await supabase.from('interested_events').select('*')

    let { data: interested_events, error } = await supabase.from('interested_events').select(`
    id,
    user_id (
      id,
      user_name,
      user_email
    ),
    event_id (
      id,
      event_title,
      date,
      time,
      location,
      category,
      price,
      description,
      image_url
    )
  `)

    if (error) {
      console.error('Error fetching interested events:', error)
      return []
    }
    console.log('This is interested event', interested_events)
  } catch (err) {
    console.error('Error fetching interested events:', err)
  }
}

fetchInterestedEvents()

async function loadEvents() {
  univentStore.dateDropdown = false
  univentStore.categoryDropdown = false
  univentStore.locationDropdown = false
  univentStore.organizerDropdown = false
  univentStore.priceDropdown = false
  const pageFromUrl =
    route.query.page && !isNaN(Number(route.query.page)) ? Number(route.query.page) : 1
  univentStore.currentPage = pageFromUrl
  if (route.query.eventId) {
    const allEvent = await fetchRequestedAndEvents(univentStore.currentPage)
    const eventId = Number(route.query.eventId)
    searchFromId.value = allEvent.allEvents.filter((e) => e.id === eventId)
    if (searchFromId.value.length === 0) {
      toast.error('Event is currently unavailable')
      unavailableEvent.value = true
    }
    return
  } else {
    try {
      loading.value = true
      const result = await fetchRequestedAndEvents(
        univentStore.currentPage,
        univentStore.activeFilters,
      )
      univentStore.pageSum = Array.from({ length: result.pagesNo }, (_, i) => i + 1)
      univentStore.pageCount = result.pagesNo
      pagesNo.value = result.pagesNo > 1
      resultNo.value = result.pagesNo
      count.value = result.count
      filter.value = await filterUpcomingEventOnlyAndInterested(result.events)
      emptyEvent.value = filter.value.length === 0
    } catch (err) {
      console.error('onMounted error:', err)
      toast.error('Failed to load events')
    } finally {
      loading.value = false
    }
  }
}

watch(
  () => route.query.page,
  () => {
    loadEvents()
  },
)
onMounted(loadEvents)

async function pagination(param) {
  router.push({
    query: {
      ...route.query,
      page: param,
    },
  })
}
async function handleFilters(filters) {
  loading.value = true

  try {
    univentStore.currentPage = 1
    univentStore.activeFilters = filters
    const result = await fetchRequestedAndEvents(univentStore.currentPage, filters)

    univentStore.pageSum = []
    for (let i = 1; i <= result.pagesNo; i++) {
      univentStore.pageSum.push(i)
    }

    filter.value = await filterUpcomingEventOnlyAndInterested(result.events)
    noEvent.value = filter.value.length === 0
    univentStore.pageCount = result.pagesNo
  } catch (err) {
    console.error('Error filtering events:', err)
    filter.value = []
    noEvent.value = true
    univentStore.pageCount = 0
  } finally {
    loading.value = false
  }
}

function backToDiscoverPage() {
  router.replace({ query: {} })
}
function showFilter() {
  isFilterActive.value = !isFilterActive.value
}
</script>
<template>
  <div class="">
    <EventSearchHeader
      header="Discover Events on Campus"
      title="Find the best happenings on campus – from academic workshops to social hangouts."
      @filter-changed="handleFilters"
      @show-filter="showFilter"
    />
    <div class="no-result" v-if="noEvent">
      <img loading="lazy" src="/no-result.png" alt="" />
    </div>
    <div :class="isFilterActive ? 'skeleton open' : 'skeleton'" v-if="loading">
      <SkeletonLoader v-for="i in 3" :key="i" />
    </div>
    <button
      :class="isFilterActive ? 'back-btn open' : 'back-btn'"
      v-if="route.query.eventId"
      @click="backToDiscoverPage"
    >
      ← Back to all Event
    </button>
    <div class="" v-if="unavailableEvent">Event currently unavailable</div>
    <div :class="isFilterActive ? 'events-section open' : 'events-section'" v-if="!loading">
      <EventsCard :events="route.query.eventId ? searchFromId : filter" />
    </div>
    <div class="" v-if="emptyEvent">Sorry no event</div>
    <div
      :class="isFilterActive ? 'pagination open' : 'pagination'"
      v-if="univentStore.pageCount > 1 && !route.query.eventId"
    >
      <h3>Page {{ univentStore.currentPage }} of {{ univentStore.pageCount }}</h3>
      <div class="buttons">
        <button
          v-for="i in univentStore.pageSum.slice(0, 4)"
          :key="i"
          @click="pagination(i)"
          :class="{ activeFilter: univentStore.currentPage == i }"
        >
          {{ i }}
        </button>
      </div>

      <div class="go-to-page">
        <p>Go to page</p>
        <select
          name="page"
          id="page"
          @change="pagination($event.target.value)"
          v-model="univentStore.currentPage"
        >
          <option v-for="i in univentStore.pageCount" :value="i" :key="i">
            {{ i }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: 24px;
  justify-content: flex-end;
  max-width: 95%;
  width: 100%;
  transition: all 0.5s ease;
  transform: translateY(-70px);
  margin: 30px auto;
}
.pagination.open {
  transform: translateY(0px);
}
.back-btn {
  transition: all 0.5s ease;
  transform: translateY(-380px);
}
.back-btn.open {
  transform: translateY(0px);
}
.pagination h3 {
  font-size: 14px;
  font-weight: 600;
  color: rgba(31, 31, 31, 1);
}
.pagination .buttons {
  display: flex;
  gap: 4px;
}
.go-to-page {
  display: flex;
  gap: 14px;
  align-items: center;
  color: #aaa;
  font-size: 14px;
}
.pagination button {
  height: 100%;
  background-color: transparent;
  color: #aaa;
  font-size: 14px;
  padding: 8px;
  border: none;
}
.pagination .activeFilter {
  border: 1px solid #1969fe;
  color: #1f1f1f;
  border-radius: 6px;
}
.skeleton {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  max-width: 90%;
  margin: 30px auto;
  width: 100%;
  gap: 16px;
  transition: all 0.5s ease;
  transform: translateY(-70px);
}
.skeleton.open {
  transform: translateY(0px);
}
.no-result {
  width: 347px;
  margin: auto;
}
.no-result img {
  width: 100%;
}
.events-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  max-width: 90%;
  position: relative;
  z-index: 0;
  width: 100%;
  margin: 30px auto;
  transition: all 0.5s ease;
  transform: translateY(-70px);
}
.events-section.open {
  transform: translateY(0px);
}
@media screen and (max-width: 500px) {
  .events-section {
    grid-template-columns: 1fr;
    margin-top: -300px;
    /* margin-bottom: 350px; */
  }
  .pagination {
    margin-top: 0px;
  }
  .skeleton {
    grid-template-columns: 1fr;
    margin-top: -300px;
  }
  .events-section.open,
  .skeleton.open {
    transform: none;
    margin-top: 0;
  }
  .pagination.open {
    margin-bottom: 100px;
  }
}
</style>
