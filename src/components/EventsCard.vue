<!-- <script setup>
import { ref, watch, computed } from 'vue'
import dayjs from 'dayjs'
import { useRoute, useRouter } from 'vue-router'
import { useUniventStore } from '@/stores/counter'
import { useInterestedEvents } from '@/composables/useInterestedEvents'
import { useRegistrable } from '@/composables/useRegistrable'
import { isEventRegistered } from '@/composables/useRegisteredEvents'
import DeleteIcon from './icons/DeleteIcon.vue'
import ShareIcon from './icons/ShareIcon.vue'
import CalendarIcon from './icons/CalendarIcon.vue'
import LocationIcon from './icons/LocationIcon.vue'
import ViewDetailsModal from './ViewDetailsModal.vue'
import RegisterModal from './RegisterModal.vue'

const univentStore = useUniventStore()
const route = useRoute()
const router = useRouter()
const { toggleInterest } = useInterestedEvents()
const { isEventRegistrable } = useRegistrable()

const props = defineProps({
  events: { type: Array, default: () => [] },
})

const emit = defineEmits(['deleteEvent'])
const localEvents = ref([...props.events])
const selectedEvent = ref(null)
const showModal = ref(false)
const registeredMap = ref({})
const selectedRegisterEvent = ref(null)
const loadingMap = ref({})

// Computed properties for route checks
const isDiscoverPage = computed(() => route.path.startsWith('/discover'))
const isInterestedPage = computed(() => route.path.startsWith('/interested'))
const isHomePage = computed(() => route.path === '/')

async function loadRegistrations(event) {
  const userId = univentStore.userProfile?.id
  if (!userId) return
  registeredMap.value[event.id] = await isEventRegistered(event, userId)
}

function onRegisterClick(event) {
  registeredMap.value[event.id] = true
}

function handleDelete(event) {
  emit('deleteEvent', event)
}

async function handleInterest(event) {
  await toggleInterest(event, localEvents)
}

async function handleRegister(event) {
  selectedRegisterEvent.value = event
  showModal.value = true
}

async function onInterestClick(event) {
  const id = event.id
  if (loadingMap.value[id]) return
  loadingMap.value[id] = true
  try {
    let registrable = false
    if (event.requires_registration != null) {
      registrable = !!event.requires_registration
    } else {
      registrable = await isEventRegistrable(event.id)
    }

    if (registrable) {
      await handleRegister(event)
    } else {
      await handleInterest(event)
    }
  } catch (err) {
    console.error('onInterestClick error:', err)
    await handleInterest(event)
  } finally {
    loadingMap.value[id] = false
  }
}

async function updateInterested(e) {
  await toggleInterest(e.event, localEvents)
}

watch(
  () => props.events,
  async (newVal) => {
    localEvents.value = [...(newVal || [])]
    selectedEvent.value = localEvents.value.find((e) => e.id === route.query.id)
    const userId = univentStore.userProfile?.id
    if (!userId) return
    await Promise.all(localEvents.value.map((event) => loadRegistrations(event)))
  },
  { immediate: true },
)

watch(
  () => selectedEvent.value,
  (newVal) => {
    if (newVal !== null) {
      router.replace({
        query: {
          ...route.query,
          modal: 'open',
          id: selectedEvent.value.id,
        },
      })
    } else {
      const { modal, id, ...rest } = route.query
      router.replace({ query: rest })
    }
  },
)
</script>
<template>
  <div class="event-card" v-for="event in localEvents" :key="event.id">
    <div class="event-flier">
      <img loading="lazy" :src="event.image_url || '/event8.avif'" alt="Event cover image" />
    </div>
    <div class="event-content">
      <div class="categories">
        <div class="category">
          <div
            v-for="(cat, index) in event.category || []"
            :key="`${event.id}-${index}-${cat}`"
            :class="`category-${index}`"
          >
            {{ cat }}
          </div>
        </div>
        <div class="price">{{ event.price === '' ? 'Free' : 'Paid' }}</div>
      </div>

      <div class="event-block">
        <h3>{{ event.event_title }}</h3>
        <div :class="['event-date-and-location', { notHomePage: !isHomePage }]">
          <div>
            <CalendarIcon /> {{ dayjs(event.date).format('dddd, MMMM D') }} •
            {{ event.time }}
          </div>
          <div :class="!isHomePage ? 'event-location' : ''">
            <span v-if="isHomePage"> • </span>
            <LocationIcon v-if="!isHomePage" />{{ event.location }}
          </div>
        </div>
      </div>

      <div class="interest-details-btn">
        <div
          v-if="isDiscoverPage"
          :class="[
            'interest',
            {
              interested: event.is_interest || registeredMap[event.id],
              loading: loadingMap[event.id],
            },
          ]"
          @click="onInterestClick(event)"
        >
          <span v-if="loadingMap[event.id]">Loading...</span>
          <template v-else-if="event.requires_registration">
            <span v-if="registeredMap[event.id]">Registered ✓</span>
            <span v-else>Register Now</span>
          </template>
          <template v-else>
            <span class="interested">{{
              event.is_interest ? 'Interested ✓ ' : 'I am Interested'
            }}</span>
          </template>
        </div>

        <Teleport to="body">
          <Transition name="modal-fade">
            <RegisterModal
              v-if="showModal && selectedRegisterEvent?.id === event.id"
              :event="selectedRegisterEvent"
              :local_Events="localEvents"
              :show-modal="showModal"
              @close="showModal = false"
              @registered="onRegisterClick(selectedRegisterEvent)"
            />
          </Transition>
        </Teleport>

        <div class="view-details" @click="selectedEvent = event">
          <p>View Details</p>
          <Teleport to="body">
            <Transition name="modal-fade">
              <ViewDetailsModal
                v-if="selectedEvent?.id === event.id"
                :event="selectedEvent"
                class-name="open"
                @close="selectedEvent = null"
                @update-interested="updateInterested"
                @share-clicked="univentStore.shareEvent(selectedEvent)"
                @click.stop
              />
            </Transition>
          </Teleport>
        </div>

        <div v-if="isInterestedPage" class="share-and-delete">
          <button class="share-btn" @click="univentStore.shareEvent(event)">
            <ShareIcon />
          </button>

          <button
            v-if="event.is_interest || registeredMap[event.id]"
            class="delete-btn"
            @click="handleDelete(event)"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
p,
h3 {
  margin: 0;
}

.events-grid-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.event-card {
  padding: 16px;
  border-radius: 24px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid #eaeaea;
  position: relative;
}

.event-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-flier {
  width: 100%;
  max-height: 250px;
  height: 100%;
}

.event-flier img {
  width: 100%;
  height: 100%;
  border-radius: 15px;
}

.categories {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category {
  display: flex;
  gap: 4px;
}

.category-0,
.category-1,
.category-2 {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
}

.category-0 {
  color: #ff2e92;
  border: 1px solid #ffc0de;
  background-color: #ffeaf4;
}

.category-1 {
  border: 1px solid #bad2ff;
  background-color: #e8f0ff;
  color: #1969fe;
}

.category-2 {
  border: 1px solid #bce6bf;
  background-color: #e7f6e8;
  color: #25ad32;
}

.price {
  font-size: 19px;
  font-weight: 600;
}

.event-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-block h3 {
  font-size: 23px;
  line-height: 120%;
}

.event-meta {
  display: flex;
  gap: 4px;
  align-items: center;
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #aaaaaa;
}

.event-meta-not-home {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #aaaaaa;
}

.event-date-and-location {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: #aaaaaa;
}

.event-date-and-location.notHomePage {
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.event-location {
  display: flex;
  align-items: center;
}

.event-meta-not-home div {
  display: flex;
  align-items: center;
  gap: 4px;
}

.interest {
  background-color: transparent;
  border: 1px solid #eaeaea;
  border-radius: 64px;
  padding: 16px 5px;
  font-size: 19px;
  font-weight: 600;
  text-align: center;
  transition: all 0.5s;
  width: 100%;
  cursor: pointer;
}

.view-details {
  width: 100%;
  border: 1px solid #eaeaea;
  padding: 16px;
  border-radius: 64px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.view-details {
  transition: all 0.5s;
}

.view-details > p {
  width: 100%;
  /* padding: 16px 0; */
  font-size: 19px;
  font-weight: 600;
  text-align: center;
  transition: all 0.5s;
}

.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  height: 100%;
  z-index: 3;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(500px);
}

.interest.interested {
  background-color: #1969fe;
  color: #fff;
}

.view-details:hover {
  background-color: #1969fe;
}

.view-details:hover > p {
  color: #fff;
}

.interest {
  border: 1px solid #1969fe;
  color: #1969fe;
}

.interest-details-btn {
  display: flex;
  width: 100%;
  gap: 8px;
}

.share-and-delete {
  display: flex;
  gap: 5px;
}

.share-and-delete button {
  border: 1px solid #eaeaea;
  padding: 16px;
  background-color: #fff;
  border-radius: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

@media screen and (max-width: 500px) {
  .event-block h3 {
    font-size: 18px;
  }

  .event-meta {
    font-size: 12px;
  }

  .view-details,
  .interest {
    padding: 14px;
    font-size: 15px;
  }

  .view-details > p {
    font-size: 15px;
  }

  .price {
    font-size: 15px;
  }
}
</style> -->
<script setup>
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useInterestedEvents } from '@/composables/useInterestedEvents'
import { useRegistrable } from '@/composables/useRegistrable'
import { useRoute, useRouter } from 'vue-router'
import DeleteIcon from './icons/DeleteIcon.vue'
import ShareIcon from './icons/ShareIcon.vue'
import CalendarIcon from './icons/CalendarIcon.vue'
import ViewDetailsModal from './ViewDetailsModal.vue'
import LocationIcon from './icons/LocationIcon.vue'
import { useUniventStore } from '@/stores/counter'
import RegisterModal from './RegisterModal.vue'
import { isEventRegistered } from '@/composables/useRegisteredEvents'
import { isInWaitingList } from '@/composables/UseWaitingList'
import {useStoreUserDetails} from '@/composables/useStoreUserDetails'
// import BellIcon from './icons/BellIcon.vue'

const univentStore = useUniventStore()
const route = useRoute()
const router = useRouter()
const { toggleInterest } = useInterestedEvents()
const { isEventRegistrable } = useRegistrable()
const { removeUserFromEvent } = useStoreUserDetails()

const props = defineProps({
  events: { type: Array, default: () => [] },
  id: String,
})

const emit = defineEmits(['deleteEvent'])
const localEvents = ref([...props.events])
const selectedEvent = ref(null)
const showModal = ref(false)
const registeredMap = ref({})
const waitingListMap = ref({})
const selectedRegisterEvent = ref(null)
const loadingMap = ref({})

async function loadRegistrations(event) {
  const userId = univentStore.userProfile?.id
  if (!userId) return
  registeredMap.value[event.id] = await isEventRegistered(event, userId)
}

async function loadWaitingListStatus(event) {
  const userId = univentStore.userProfile?.id
  if (!userId) return
  waitingListMap.value[event.id] = await isInWaitingList(event, userId)
}

function onRegisterClick(event) {
  registeredMap.value[event.id] = true
  // showModal.value = false
}

// function onUnregisterClick(event) {
//   registeredMap.value[event.id] = false
//   removeUserFromEvent(event)
//   // showModal.value = false
// }

async function handleDelete(event) {
  if (registeredMap.value[event.id]){
    await removeUserFromEvent(event)
  }
  emit('deleteEvent', event)

}
async function handleInterest(event) {
  await toggleInterest(event, localEvents)
}

async function handleRegister(event) {
  selectedRegisterEvent.value = event
  showModal.value = true
}

async function onInterestClick(event) {
  const id = event.id
  if (loadingMap.value[id]) return
  loadingMap.value[id] = true
  try {
    let registrable = false
    if (event.requires_registration != null) {
      registrable = !!event.requires_registration
      console.log('Event requires_registration:', registrable)
    } else {
      registrable = await isEventRegistrable(event.id)
    }

    if (registrable) {
      if (registeredMap.value[event.id]) {
        registeredMap.value[event.id] = false
        await removeUserFromEvent(event)
      } else {
      await handleRegister(event)
      }
    } else {
      await handleInterest(event)
    }
  } catch (err) {
    console.error('onInterestClick error:', err)
    await handleInterest(event)
  } finally {
    loadingMap.value[id] = false
  }
}

async function updateInterested(e) {
  await toggleInterest(e.event, localEvents)
}
watch(
  () => props.events,
  async (newVal) => {
    localEvents.value = [...(newVal || [])]
    selectedEvent.value = localEvents.value.find((e) => e.id === route.query.id)
    const userId = univentStore.userProfile?.id
    if (!userId) return
    for (const event of localEvents.value) {
      await Promise.all([
        loadRegistrations(event),
        loadWaitingListStatus(event),
      ])
    }
  },
  { immediate: true },
)
watch(
  () => selectedEvent.value,
  (newVal) => {
    if (newVal !== null) {
      router.replace({
        query: {
          ...route.query,
          modal: 'open',
          id: selectedEvent.value.id,
        },
      })
    } else {
      const { modal, id, ...rest } = route.query
      router.replace({ query: rest })
    }
  },
)
</script>
<template>
  <div class="event-card" v-for="event in localEvents" :key="event.id">
    <div v-if="waitingListMap[event.id] === true" class="waitlist-badge">In Wait-list</div>
    <div class="event-flier"><img loading="lazy" :src="event.image_url" alt="" /></div>
    <div class="event-content">
      <div class="categories">
        <div class="category">
          <div :class="`category-${i}`" v-for="(cat, i) in event.category" :key="i">
            {{ cat }}
          </div>
        </div>
        <div class="price">{{ event.price === '' ? 'Free' : 'Paid' }}</div>
      </div>

      <div class="event-block">
        <h3>{{ event.event_title }}</h3>
        <p>{{ registeredMap[event.id] }}</p>
        <div :class="['event-date-and-location', { notHomePage: route.path !== '/' }]">
          <div class="">
            <CalendarIcon /> {{ dayjs(event.date).format('dddd, MMMM D') }} •
            {{ event.time }}
          </div>
          <div :class="route.path !== '/' ? 'event-location' : ''">
            <span v-if="route.path == '/'"> • </span>
            <LocationIcon v-if="route.path !== '/'" />{{ event.location }}
          </div>
        </div>
      </div>

      <div class="interest-details-btn">
        <div :class="[
          'interest',
          {
            interested: event.is_interest || registeredMap[event.id],
            loading: loadingMap[event.id],
          },
        ]" v-if="route.path.startsWith('/discover')" @click="onInterestClick(event)">
          <span v-if="loadingMap[event.id]">Loading...</span>

          <template v-else-if="event.requires_registration">
            <span v-if="registeredMap[event.id]">Registered ✓</span>
            <span v-else>Register Now</span>
          </template>
          <template v-else>
            <span class="interested">{{
              event.is_interest ? 'Interested ✓ ' : 'I am Interested'
            }}</span>
          </template>
        </div>

        <div>
          <teleport to="body">
            <Transition name="modal-fade">
              <div v-if="!registeredMap[event.id]">
              <RegisterModal v-if="showModal" :event="selectedRegisterEvent" :local_Events="localEvents"
                :show-modal="showModal" @close="showModal = false"
                @registered="onRegisterClick(selectedRegisterEvent)" />
              </div>
            </Transition>
          </teleport>
        </div>
        <div class="view-details" @click="selectedEvent = event">
          <p>View Details</p>
          <teleport to="body">
            <Transition name="modal-fade">
              <ViewDetailsModal v-if="selectedEvent" :event="selectedEvent" class-name="open"
                @close="selectedEvent = null" @update-interested="updateInterested"
                @share-clicked="univentStore.shareEvent(selectedEvent)" @click.stop />
            </Transition>
          </teleport>
        </div>

        <div class="share-and-delete" v-if="route.path.startsWith('/interested')">
          <button class="share-btn" @click="univentStore.shareEvent(event)">
            <ShareIcon />
          </button>

          <button class="delete-btn" v-if="event.is_interested === true || registeredMap[event.id]"
            @click="handleDelete(event)">
            <DeleteIcon />
          </button>
          <!-- <button class="delete-btn" @click="checkInterestedStatus(event)"><DeleteIcon /></button> -->
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
p,
h3 {
  margin: 0;
}

.loading {
  cursor: not-allowed;
  opacity: 0.6;
}

.events-grid-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.event-card {
  padding: 16px;
  border-radius: 24px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid #eaeaea;
  position: relative;
}

.interest-btn {
  position: absolute;
  right: 25px;
  top: 30px;
  cursor: pointer;
}

.event-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-flier {
  width: 100%;
  max-height: 225px;
  height: 100%;
  min-height: 160px;
}

.event-flier img {
  width: 100%;
  height: 100%;
  border-radius: 15px;
  object-fit: cover;
}

.categories {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category {
  display: flex;
  gap: 4px;
}

.category-0,
.category-1,
.category-2 {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
}

.category-0 {
  color: #ff2e92;
  border: 1px solid #ffc0de;
  background-color: #ffeaf4;
}

.category-1 {
  border: 1px solid #bad2ff;
  background-color: #e8f0ff;
  color: #1969fe;
}

.category-2 {
  border: 1px solid #bce6bf;
  background-color: #e7f6e8;
  color: #25ad32;
}

.price {
  font-size: 14px;
  font-weight: 700;
}

.event-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-block h3 {
  font-size: 16px;
  line-height: 1.3;
  font-weight: 600;
}

.event-meta {
  display: flex;
  gap: 4px;
  align-items: center;
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #aaaaaa;
}

.event-meta-not-home {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #aaaaaa;
}

.event-date-and-location {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: #aaaaaa;
  font-size: 14px;
}

.event-date-and-location.notHomePage {
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.event-location {
  display: flex;
  align-items: center;
}

.event-meta-not-home div {
  display: flex;
  align-items: center;
  gap: 4px;
}

.interest {
  background-color: transparent;
  border: 1px solid #eaeaea;
  border-radius: 64px;
  padding: 16px 5px;
  /* font-size: 19px; */
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  transition: all 0.5s;
  width: 100%;
  cursor: pointer;
}
.interest:hover {
  background-color: #f3f4f6;
}

.view-details {
  width: 100%;
  border: 1px solid #eaeaea;
  padding: 16px;
  border-radius: 64px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.view-details {
  transition: all 0.5s;
}

.view-details>p {
  width: 100%;
  /* padding: 16px 0; */
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  transition: all 0.5s;
}

.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  height: 100%;
  z-index: 3;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(500px);
}

.interest.interested {
  background-color: #1969fe;
  color: #fff;
}

.view-details:hover {
  background-color: #1969fe;
}

.view-details:hover>p {
  color: #fff;
}

.interest {
  border: 1px solid #1969fe;
  color: #1969fe;
}

.interest-details-btn {
  display: flex;
  width: 100%;
  gap: 8px;
}

.share-and-delete {
  display: flex;
  gap: 5px;
}

.share-and-delete button {
  border: 1px solid #eaeaea;
  padding: 16px;
  background-color: #fff;
  border-radius: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.waitlist-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #ffe066;
  color: #a67c00;
  border-radius: 16px;
  padding: 6px 16px;
  font-weight: 700;
  font-size: 14px;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

@media screen and (max-width: 500px) {
  .event-block h3 {
    font-size: 18px;
  }

  .event-meta {
    font-size: 12px;
  }

  .view-details,
  .interest {
    padding: 14px;
    font-size: 15px;
  }

  .view-details>p {
    font-size: 15px;
  }

  .price {
    font-size: 15px;
  }
}
</style>
