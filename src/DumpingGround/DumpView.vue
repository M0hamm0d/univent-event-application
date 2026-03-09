<script setup>
import { onMounted } from 'vue'
import { supabase } from '@/supabase'
import { useUserProfile } from '@/composables/useUserProfile'

const { loading, error, profile, fetchProfile } = useUserProfile()

const fetchSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error fetching session:', error.message)
    return null
  }
  console.log(data.session)
  return data.session
}

onMounted(async () => {
  const session = await fetchSession()
  if (session?.user) {
    const result = await fetchProfile(session.user.id)
    console.log(result)
  }
})

///
const fetchRequestedAndEvents = async (param = null) => {
  const from = param ? (param - 1) * perPage.value : null
  const to = param ? from + perPage.value - 1 : null

  try {
    const { data: requested_event, error: reqError } = await supabase
      .from('requested-event')
      .select('*')

    let query = supabase.from('events').select('*', { count: 'exact' }).gte('date', today)
    if (param) {
      query = query.range(from, to)
    }

    const { data: events, error: eventError, count } = await query

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id
    const pageCount = Math.ceil(count / perPage.value)

    if (reqError || eventError || sessionError) {
      throw reqError || eventError || sessionError
    }

    if (!userId) {
      console.log('noSession')
      return {
        success: true,
        requested_event: requested_event || [],
        events: events || [],
        pagesNo: pageCount,
        count: count,
      }
    }

    const { data: profile_data, error: profileError } = await supabase
      .from('profile')
      .select('interested_events')
      .eq('id', userId)
      .single()

    if (profileError) {
      throw profileError
    }

    const firstWord = profile_data?.interested_events?.map((item) => item.split(' ')[0]) || []

    const matching = events.filter((evt) => firstWord.some((word) => evt.category.includes(word)))

    const notMatching = events.filter(
      (evt) => !firstWord.some((word) => evt.category.includes(word)),
    )

    const orderedEvent = [...matching, ...notMatching]

    return {
      success: true,
      requested_event: requested_event || [],
      events: orderedEvent,
      pagesNo: pageCount,
      count: count,
    }
  } catch (err) {
    console.error('fetchRequestedAndEvents error:', err)
    return { success: false, error: err.message }
  }
}

///useEvent
import { ref } from 'vue'
import { supabase } from '@/supabase'
// import { modalStore } from '@/stores/counter'

export function useEventFilters() {
  // const store = modalStore()
  const loading = ref(false)
  const noEvent = ref(false)
  const filter = ref([])
  const debounceTimer = ref(null)

  async function filterUpcomingEventOnlyAndInterested(param) {
    loading.value = true
    let today = new Date()
    today.setHours(0, 0, 0, 0)

    // let sessionData = store.session || (await store.fetchSession())
    // store.session = sessionData
    //
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Error fetching session:', error.message)
      return null
    }
    let sessionData = data.session
    //

    if (!sessionData) {
      return param
        .map((e) => ({ ...e, is_interest: false }))
        .filter((e) => new Date(e.date).setHours(0, 0, 0, 0) >= today)
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      console.error('Error getting user:', userError)
      return param
        .map((e) => ({ ...e, is_interest: false }))
        .filter((e) => new Date(e.date).setHours(0, 0, 0, 0) >= today)
    }

    const { data: interested_events, error: interestedError } = await supabase
      .from('interested_events')
      .select('event_id')
      .eq('user_id', userData.user.id)

    if (interestedError) {
      console.error('Error fetching interested events:', interestedError)
      return []
    }

    const interestedId = new Set(interested_events.map((e) => e.event_id))

    return param
      .map((e) => ({
        ...e,
        is_interest: interestedId.has(e.id),
      }))
      .filter((e) => new Date(e.date).setHours(0, 0, 0, 0) >= today)
  }

  async function handleFilters(filters) {
    const { data: events, error: event_error } = await supabase.from('events').select('*')
    if (event_error) {
      console.error('Error during filter:', event_error.message)
      return null
    }
    let eventsArray = events
    let upcomingEventArray = await filterUpcomingEventOnlyAndInterested(eventsArray)
    loading.value = true

    if (filters.searchInput) {
      if (debounceTimer.value) clearTimeout(debounceTimer.value)
      debounceTimer.value = setTimeout(() => {
        const query = filters.searchInput.toLowerCase().trim()
        const results = upcomingEventArray.filter((e) =>
          e.event_title.toLowerCase().includes(query),
        )
        filter.value = results
        loading.value = false
        noEvent.value = results.length === 0
      }, 500)
      return
    }

    if (!filters.price && !filters.location && !filters.category) {
      filter.value = [...upcomingEventArray]
      noEvent.value = filter.value.length === 0
      loading.value = false
      return
    }

    try {
      filter.value = upcomingEventArray.filter((event) => {
        let match = true
        let categories = Array.isArray(event.category)
          ? event.category.map((c) => c.toLowerCase())
          : [String(event.category || '').toLowerCase()]

        if (filters.category?.length) {
          match = match && filters.category.some((cat) => categories.includes(cat.toLowerCase()))
        }

        if (filters.location?.length) {
          match =
            match &&
            filters.location.some((loc) => event.location.toLowerCase().includes(loc.toLowerCase()))
        }

        if (filters.price) {
          match = match && event.price <= filters.price
        }

        return match
      })
    } catch (err) {
      console.error('Error filtering events:', err)
      filter.value = []
    } finally {
      noEvent.value = filter.value.length === 0
      loading.value = false
    }
  }

  return {
    filter,
    loading,
    noEvent,
    handleFilters,
    filterUpcomingEventOnlyAndInterested,
  }
}

generateEmailTemplate({
  name: event.user_id.user_name,
  title: event.event_id.event_title,
  date: event.event_id.date,
  time: event.event_id.time,
  location: event.event_id.location,
  type: 'happening tomorrow',
})
</script>

<template>
  <div>
    <h1>This is DiscoverView</h1>
    <p v-if="loading">Loading profile...</p>
    <p v-if="error">{{ error }}</p>
    <div v-if="profile">
      <p>{{ profile }}</p>
      <div class="profile">
        <img loading="lazy" :src="profile.profile_pics" alt="" />
      </div>
    </div>
  </div>
</template>
<style>
.profile {
  width: 50px;
}
.profile img {
  width: 100%;
}
</style>
//eVENTCARD
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
