<script setup>
import { ref, watch } from 'vue'
import CalendarIcon from './icons/CalendarIcon.vue'
import CardIcon from './icons/CardIcon.vue'
import LocationIcon from './icons/LocationIcon.vue'
import OrganizersIcon from './icons/OrganizersIcon.vue'
import RegisterIcon from './icons/RegisterIcon.vue'
import ShareIcon from './icons/ShareIcon.vue'
import dayjs from 'dayjs'
import CancelBtn from './icons/CancelBtn.vue'
const emit = defineEmits(['close', 'update-interested', 'share-clicked'])
let prop = defineProps({
  event: {
    type: Object,
  },
  className: {
    type: String,
  },
})
function updateInterested(e) {
  emit('update-interested', { checked: e.target.checked, event: prop.event })
}
let is_interested = ref(prop.event.is_interested)
watch(is_interested, (newVal) => {
  is_interested.value = newVal
})
</script>
<template>
  <div class="container" @click="emit('close')">
    <div :class="['view-details-wrapper', { open: className }]" @click.stop>
      <div class="close" @click="emit('close')">
        <CancelBtn />
      </div>
      <div class="view-details">
        <div class="header">
          <div class="title">
            <h2>{{ event.event_title }}</h2>
            <div class="category">
              <div v-for="(cat, i) in event.category" :class="[`category-${i}`]" :key="i">
                {{ cat }}
              </div>
            </div>
          </div>
          <div class="event-flier">
            <img loading="lazy" :src="event.image_url" alt="" />
          </div>
        </div>
        <div class="event-overview">
          <div class="about-event">
            <h4>About the Event</h4>
            <p>{{ event.description }}</p>
          </div>
          <div class="divider-line"></div>
          <div class="event-details">
            <h4>Event Details</h4>
            <div class="details">
              <div class="event-meta">
                <span><CalendarIcon /></span>
                <span
                  >{{ dayjs(event.date).format('dddd, MMMM D') }}
                  {{ event.date.split('').slice(0, 4).join('') }}</span
                >
                <span>•</span>
                <span>{{ event.time }}</span>
              </div>
              <div class="event-meta">
                <span><LocationIcon /></span>
                <span>{{ event.location }}</span>
              </div>
              <div class="event-meta">
                <span><OrganizersIcon /></span>
                <span>Computer Science Club</span>
                <span>•</span>
                <span>csclub@university.edu</span>
              </div>
              <div class="event-meta" v-if="event.price">
                <span><CardIcon /></span>
                <span>N{{ event.price }}</span>
              </div>
              <div class="event-meta" v-if="event.link_to_register">
                <span><RegisterIcon /></span>
                <a :href="event.link_to_register">Click here to register</a>
              </div>
            </div>
          </div>
          <div class="divider-line"></div>
          <div class="interested-share">
            <div class="interested">
              <input
                type="checkbox"
                name="interested"
                id=""
                :checked="prop.event.is_interest"
                @change="updateInterested"
              />
              <p>I'm Interested</p>
            </div>
            <button @click="emit('share-clicked')" class="share-icon">
              <ShareIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.share-icon {
  cursor: pointer;
}
.container {
  position: fixed;
  display: flex;
  inset: 0 0 0 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.1);
}
.divider-line {
  width: 100%;
  height: 1px;
  background-color: #eaeaea;
}
p,
h2,
h4 {
  margin: 0;
}
.view-details-wrapper {
  /* max-width: 50%; */
  max-width: 400px;
  max-height: 80%;
  /* height: 100%; */
  position: relative;
  width: 450px;
  width: 100%;
  background-color: #fff;
  margin: auto;
  padding: 0 30px 30px;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  gap: 40px;
  overflow-y: auto;
  scrollbar-width: none;
  z-index: 100;
}
.close {
  display: none;
}
.category {
  display: flex;
  gap: 4px;
}
.header,
.title {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.view-details {
  display: flex;
  flex-direction: column;
  margin-top: 30px;
}
.header {
  gap: 20px;
}
.title h2 {
  font-size: 20px;
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
.event-flier {
  width: 100%;
}
.event-flier img {
  width: 100%;
  height: 260px;
}
.event-overview {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.about-event,
.event-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.about-event h4 {
  font-weight: 600;
  font-size: 19px;
  line-height: 120%;
}
.about-event p {
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #5a5a5a;
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
.event-meta a {
  color: #1969fe;
}
.interested-share {
  display: flex;
  align-items: center;
  gap: 24px;
}
.interested {
  display: flex;
  color: #959595;
  font-size: 19px;
  gap: 8px;
}
.interested-share button {
  background-color: transparent;
  border: 1px solid #eaeaea;
  padding: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
@media screen and (max-width: 500px) {
  .close {
    display: flex;
    position: fixed;
    top: 11%;
    right: 7%;
  }
  .view-details-wrapper {
    padding-bottom: 60px;
  }
}
</style>
