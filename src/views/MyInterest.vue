<script setup>
import EventsCard from '@/components/EventsCard.vue'
import EventSearchHeader from '@/components/EventSearchHeader.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useToast } from 'vue-toastification'
import { useInterestedEvents } from '@/composables/useInterestEvents'
import { useUniventStore } from '@/stores/counter'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const toast = useToast()
const univentStore = useUniventStore()
const { active, deleteInterest, loading, fetchInterest, filtersArray, interest } =
  useInterestedEvents(toast)
const searchInput = ref(route.query.q || '')

function handleDelete(event) {
  deleteInterest(event)
}
const res = ref([])
const isFilterActive = ref(false)
watch(active, async () => {
  univentStore.interestFilters = {
    ...univentStore.interestFilters,
    searchInput: '',
    category: [],
    activeVal: active,
  }
  searchInput.value = ''
  result.value = await fetchInterest(1, univentStore.interestFilters)
  router.replace({ query: {} })
  res.value = result.value.events.map((e) => e.events)
})

const result = ref([])

const pageSum = ref([])
async function handleFilters(e) {
  univentStore.interestFilters = e
  result.value = await fetchInterest(univentStore.interestCount, e)
  res.value = result.value.events.map((e) => e.events)
  for (let i = 0; i < result.value.pageSum; i++) {
    pageSum.value.push(i + 1)
  }
}
function showFilter() {
  isFilterActive.value = !isFilterActive.value
}
onMounted(async () => {
  univentStore.dateDropdown = false
  univentStore.categoryDropdown = false
  univentStore.locationDropdown = false
  univentStore.organizerDropdown = false
  univentStore.priceDropdown = false
  univentStore.interestCount = Number(route.query.page) || 1
  result.value = await fetchInterest(univentStore.interestCount)
  res.value = result.value.events.map((e) => e.events)
  for (let i = 0; i < result.value.pageSum; i++) {
    pageSum.value.push(i + 1)
  }
})
async function pagination(param) {
  result.value = await fetchInterest(param, univentStore.interestFilters)
  univentStore.interestCount = param
  console.log(univentStore.interestCurrentPage)

  res.value = result.value.events.map((e) => e.events)
  for (let i = 0; i < result.value.pageSum; i++) {
    pageSum.value.push(i + 1)
  }
}
watch(
  () => univentStore.interestCount,
  (newVal) => {
    router.replace({
      query: {
        ...route.query,
        page: newVal,
      },
    })
  },
)
</script>

<template>
  <div class="interested-events">
    <EventSearchHeader
      header="Interested Events"
      title="Keep track of all the events you’ve marked interest in."
      @filter-changed="handleFilters"
      @show-filter="showFilter"
    />

    <div :class="isFilterActive ? 'interest-container open' : 'interest-container'">
      <div class="upcoming-past">
        <button
          :class="['upcoming-event', { upcomingActive: active === 'upcoming' }]"
          @click="active = 'upcoming'"
        >
          Upcoming Events
        </button>
        <button
          :class="['past-event', { upcomingActive: active === 'past' }]"
          @click="active = 'past'"
        >
          Past Events
        </button>
      </div>
      <div class="upcoming-events-container">
        <div class="" v-if="!res.length >= 1 && !loading">No Interested Events</div>
        <EventsCard
          :events="interest.map((e) => e.events)"
          v-if="res.length >= 1 && !loading"
          @deleteEvent="handleDelete"
          @show-filter="showFilter"
        />
        <div class="skeleton" v-if="loading">
          <SkeletonLoader v-for="i in 3" :key="i" />
        </div>
      </div>
      <p>{{ filtersArray }}</p>
      <div class="pagination" v-if="result?.pageSum > 1">
        <h3>Page {{ result?.currentPage }} of {{ result?.pageSum }}</h3>
        <div class="buttons">
          <button
            v-for="(data, i) in pageSum.slice(0, 3)"
            :key="i"
            @click="pagination(i + 1)"
            :class="{ activeNav: result.currentPage === i + 1 }"
          >
            {{ i + 1 }}
          </button>
          <p>Go to page</p>
          <select
            name=""
            id=""
            v-model="result.currentPage"
            @change="pagination($event.target.value)"
          >
            <option :value="i" v-for="i in result.pageSum" :key="i">{{ i }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interest-container {
  transition: all 0.5s ease;
  transform: translateY(-70px);
}
.interest-container.open {
  transform: translateY(0px);
}
.pagination {
  display: flex;
  align-items: center;
  gap: 24px;
  justify-content: flex-end;
  max-width: 95%;
  width: 100%;
  /* margin: 30px auto; */
}
.pagination h3 {
  font-size: 14px;
  font-weight: 600;
  color: rgba(31, 31, 31, 1);
}
.pagination .buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pagination .buttons p {
  margin: 0 5px;
  font-size: 14px;
  color: #aaa;
}
.interested-events {
  display: flex;
  flex-direction: column;
}
.pagination button {
  height: 100%;
  background-color: transparent;
  color: #aaa;
  font-size: 14px;
  padding: 8px;
  border: none;
}
.pagination .activeNav {
  border: 1px solid #1969fe;
  color: #1f1f1f;
  border-radius: 6px;
}
.upcoming-events-container {
  max-width: 90%;
  width: 100%;
  gap: 16px;
  display: grid;
  margin: 0 auto;
  grid-template-columns: 1fr 1fr 1fr;
}
.upcoming-past {
  display: flex;
  border-bottom: 2px solid #eaeaea;
  margin: 20px auto 50px;
  max-width: 90%;
  width: 100%;
}
.upcoming-past button {
  width: 298px;
  padding: 16px 0;
  background: transparent;
  border: 0;
  color: #5a5a5a;
  font-weight: 600;
  font-size: 19px;
}
.upcoming-past .upcomingActive {
  border-bottom: 2px solid #1969fe;
  background: #f4f4f4;
}
@media screen and (max-width: 500px) {
  .interest-container {
    margin-top: -330px;
  }
  .upcoming-events-container {
    grid-template-columns: 1fr;
  }
  .pagination {
    justify-content: space-between;
    margin: 30px auto;
    max-width: 90%;
  }
  .interest-container.open {
    transform: 0;
    margin-top: 0px;
    margin-bottom: 80px;
  }
}
</style>
