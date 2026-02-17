<script setup>
import { ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useInterestedEvents } from '@/composables/useInterestedEvents'
import { useRoute, useRouter } from 'vue-router'
import DeleteIcon from './icons/DeleteIcon.vue'
import ShareIcon from './icons/ShareIcon.vue'
import CalendarIcon from './icons/CalendarIcon.vue'
import ViewDetailsModal from './ViewDetailsModal.vue'
import LocationIcon from './icons/LocationIcon.vue'
import { useUniventStore } from '@/stores/counter'
// import BellIcon from './icons/BellIcon.vue'

const univentStore = useUniventStore()
const route = useRoute()
const router = useRouter()
const { toggleInterest } = useInterestedEvents()

const props = defineProps({
  events: { type: Array, default: () => [] },
  id: String,
})

const emit = defineEmits(['deleteEvent'])
const localEvents = ref([...props.events])
const selectedEvent = ref(null)

function handleDelete(event) {
  emit('deleteEvent', event)
}
async function handleInterest(event) {
  await toggleInterest(event, localEvents)
}

async function updateInterested(e) {
  await toggleInterest(e.event, localEvents)
}
watch(
  () => props.events,
  (newVal) => {
    localEvents.value = [...(newVal || [])]
    const eventSelected = ref(localEvents.value.find((e) => e.id === route.query.id))
    selectedEvent.value = eventSelected.value
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
  <div class="event-card" v-for="(event, i) in props.events" :key="i">
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
        <div
          :class="['interest', { interested: event.is_interest }]"
          v-if="route.path.startsWith('/discover')"
          @click="handleInterest(event)"
        >
          {{ event.is_interest ? 'Interested ✓ ' : 'I am Interested' }}
        </div>

        <div class="view-details" @click="selectedEvent = event">
          <p>View Details</p>

          <!-- @share-clicked="univentStore.shareEvent(event?.id)" -->

          <teleport to="body">
            <Transition name="modal-fade">
              <ViewDetailsModal
                v-if="selectedEvent"
                :event="selectedEvent"
                class-name="open"
                @close="selectedEvent = null"
                @update-interested="updateInterested"
                @share-clicked="univentStore.shareEvent(selectedEvent)"
                @click.stop
              />
            </Transition>
          </teleport>
        </div>

        <div class="share-and-delete" v-if="route.path.startsWith('/interested')">
          <button class="share-btn" @click="univentStore.shareEvent(event)">
            <ShareIcon />
          </button>

          <button class="delete-btn" @click="handleDelete(event)"><DeleteIcon /></button>
          <!-- <button class="delete-btn" @click="checkInterestedStatus(event)"><DeleteIcon /></button> -->
        </div>
      </div>
    </div>
  </div>
</template>
"
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
</style>
