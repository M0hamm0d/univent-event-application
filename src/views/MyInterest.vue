<script setup>
import EventsCard from '@/components/EventsCard.vue'
import EventSearchHeader from '@/components/EventSearchHeader.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useToast } from 'vue-toastification'
import { useInterestedEvents } from '@/composables/useInterestEvents'
import { useUniventStore } from '@/stores/counter'
import { onMounted, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStoreUserDetails } from '@/composables/useStoreUserDetails'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()

const toast = useToast()
const univentStore = useUniventStore()
const { active, deleteInterest, loading, fetchInterest, filtersArray, interest } =
  useInterestedEvents(toast)
const searchInput = ref(route.query.q || '')
const { removeUserFromEvent } = useStoreUserDetails()
const result = ref([])
const showDeleteModal = ref(false)
const deleteType = ref('')
const subText = ref('')
const eventToDelete = ref(null)
const activeModal = ref('')

async function handleDelete(event) {
  showDeleteModal.value = true
  deleteType.value = 'deleteInterest'
  subText.value = 'Are you sure you want to remove this event from your interests?'
  eventToDelete.value = event
  activeModal.value = 'deleteInterest'
  // if (confirm('Are you sure you want to remove this event from your interests?')) {
  //   await deleteInterest(event)
  // }
}
function cancel() {
  showDeleteModal.value = false
  eventToDelete.value = null
  activeModal.value = ''
}
async function handleDeleteUserRegistration(event) {
  showDeleteModal.value = true
  deleteType.value = 'cancelRegistration'
  subText.value = 'Are you sure you want to cancel your registration for this event?'
  eventToDelete.value = event
  activeModal.value = 'cancelRegistration'
  // if (confirm('Are you sure you want to cancel your registration for this event?')) {
  //   await deleteInterest(event)
  //   await removeUserFromEvent(event)
  // }
}
async function deleteConfirmed() {
  if (activeModal.value === 'deleteInterest') {
    await deleteInterest(eventToDelete.value)
  } else if (activeModal.value === 'cancelRegistration') {
    console.log(toRaw(eventToDelete.value), 'event to delete')
    await removeUserFromEvent(eventToDelete.value)
    await deleteInterest(eventToDelete.value)
  }
  cancel()
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
        <EventsCard
          :events="
            interest.map((e) => ({
              ...e.events,
              is_interested: e.is_interested || false,
              is_registered: e.is_registered || false,
            }))
          "
          v-if="res.length >= 1 && !loading"
          @deleteEvent="handleDelete"
          @deleteUserRegistration="handleDeleteUserRegistration"
        />
      </div>
      <div class="" v-if="!res.length >= 1 && !loading">
        <EmptyState />
      </div>
      <div class="skeleton" v-if="loading">
        <SkeletonLoader v-for="i in 3" :key="i" />
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
    <!-- up -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="cancel">
      <div class="modal-card" @click.stop>
        <div class="icon-container">
          <div class="icon-circle">
            <span class="icon-inner">!</span>
          </div>
        </div>

        <div class="modal-body">
          <h2 v-if="deleteType === 'deleteInterest'">Remove Interest?</h2>
          <h2 v-else-if="deleteType === 'cancelRegistration'">Cancel Registration?</h2>

          <p class="sub-text">{{ subText }}</p>

          <div class="modal-actions">
            <button class="btn-outline" @click="cancel">Cancel</button>
            <button class="btn-confirm" @click="deleteConfirmed" :disabled="loading">
              {{ loading ? 'Processing...' : 'Yes, I Agree' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- end -->
  </div>
</template>

<style scoped>
/* Overlay with a subtle blur */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.1);
  /* backdrop-filter: blur(2px); */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* The White Card */
.modal-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 40px 32px 32px 32px;
  width: 100%;
  max-width: 450px;
  text-align: center;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  position: relative;
}

/* Icon Styling */
.icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.icon-circle {
  width: 60px;
  height: 60px;
  background: #ffe5e5; /* Soft blue tint */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.icon-circle::after {
  content: '';
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #ffe5e5;
  opacity: 0.4;
}
.icon-inner {
  color: red;
  font-size: 24px;
  font-weight: bold;
  border: 2px solid red;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

/* Typography */
h2 {
  font-size: 24px;
  color: #1e293b;
  margin: 0 0 12px 0;
  font-weight: 700;
}
.main-text {
  font-size: 16px;
  color: #64748b;
  margin-bottom: 8px;
}
.sub-text {
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 30px;
}

/* Action Buttons */
.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.single-btn {
  grid-template-columns: 1fr;
}

button {
  padding: 14px 20px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-outline {
  background: transparent;
  border: 1.5px solid #e2e8f0;
  color: #64748b;
}
.btn-outline:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn-confirm,
.btn-primary {
  background: transparent;
  border: 1.5px solid red;
  color: red;
}
.btn-confirm:hover,
.btn-primary:hover {
  background: red;
  color: #ffffff;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .modal-card {
    padding: 30px 20px 20px 20px;
  }
  .modal-actions {
    grid-template-columns: 1fr; /* Stack buttons on mobile */
  }
}
/* end */
.skeleton {
  display: flex;
  gap: 16px;
  max-width: 90%;
  width: 100%;
  margin: 0 auto;
}
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
  border-radius: 0;
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
  .skeleton {
    max-width: 90%;
    width: 100%;
    margin: 0 auto;
    flex-direction: column;
  }
}
</style>
