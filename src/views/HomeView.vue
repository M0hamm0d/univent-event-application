<script setup>
import ArrowUp from '@/components/icons/ArrowUp.vue'
import EventsCard from '@/components/EventsCard.vue'
import SearchingIcon from '@/components/icons/SearchingIcon.vue'
import SaveIcon from '@/components/icons/SaveIcon.vue'
import JoinIcon from '@/components/icons/JoinIcon.vue'
import ArrowUpBlue from '@/components/icons/ArrowUpBlue.vue'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRequestedEvents } from '@/composables/useRequestedEvents'
const { fetchRequestedAndEvents } = useRequestedEvents()
import { useUniventStore } from '@/stores/counter'
import SubmitEventLogo from '@/components/icons/SubmitEventLogo.vue'
import SignUpLogo from '@/components/icons/SignUpLogo.vue'
import router from '@/router'
import { supabase } from '@/supabase'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
const vAnimateOnScroll = {
  mounted(el, binding) {
    const animationClass = binding.value || 'fade-up'
    el.classList.add(animationClass)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    el._observer = observer
  },
  unmounted(el) {
    if (el._observer) {
      el._observer.unobserve(el)
      el._observer.disconnect()
      delete el._observer
    }
  },
}
const univentStore = useUniventStore()
function guardRoute(param) {
  if (param == 'add-event') {
    if (univentStore.isAuthenticated) {
      router.push('/add-event')
    } else {
      univentStore.loginModal = true
    }
  }
  if (param == 'interested') {
    if (univentStore.isAuthenticated) {
      router.push('/interested')
    } else {
      univentStore.loginModal = true
    }
  }
}

function pushToSubmitOrSignup(i) {
  if (i == 1) {
    univentStore.signupModal = !univentStore.signupModal
  }
  if (i === 0) {
    if (univentStore.isAuthenticated) {
      router.push('/add-event')
    } else {
      univentStore.loginModal = true
    }
  }
}
const cards = [
  { title: 'Hosting an event? Submit it here.', btnContent: 'Submit Event', logo: SubmitEventLogo },
  {
    title: 'Sign up to save events and get reminders!',
    btnContent: 'Sign Up Now',
    logo: SignUpLogo,
  },
]
////
const checkAuthenticatedUser = computed(() => {
  if (univentStore.isAuthenticated) {
    return cards.filter((_, i) => i != 1)
  } else {
    return cards
  }
})

const currentIndex = ref(0)
let interval = null
const isAuthenticated = ref(null)
const fetchSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error fetching session:', error.message)
    return null
  }
  return data.session
}
const eventValue = ref([])

onMounted(async () => {
  const result = await fetchRequestedAndEvents()
  const session = await fetchSession()
  univentStore.isAuthenticated = !!session?.user
  isAuthenticated.value = !!session?.user
  if (result.success) {
    eventValue.value = result.events
  } else {
    console.error(result.error)
  }
  interval = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % cards.length
  }, 4000)
})
onUnmounted(() => {
  clearInterval(interval)
})

const categories = [
  { category: 'Academic', icon: '/Academic.webp' },
  { category: 'social', icon: '/social.webp' },
  { category: 'Cultural', icon: '/cultural.webp' },
  { category: 'Sports', icon: '/sport.webp' },
  { category: 'Workshops', icon: '/workshop.webp' },
  { category: 'Career', icon: '/career.webp' },
  { category: 'Tech', icon: '/tech.webp' },
  { category: 'Organization', icon: '/organization.webp' },
]
</script>
<template>
  <div class="container">
    <div class="hero-section-container">
      <div class="hero-section">
        <div v-animate-on-scroll="'hero-content'">
          <h1>Discover What’s Happening on Your Campus</h1>
          <p>
            Your one-stop hub for all university events—from workshops to epic social nights. Never
            miss out on the action!
          </p>
          <div class="">
            <RouterLink to="/discover">
              <button class="hero-explore-btn">
                <span>Explore Events Now</span>
                <span><ArrowUp /></span>
              </button>
            </RouterLink>
            <button class="hero-post-btn" @click="guardRoute('add-event')">Post Your Event</button>
          </div>
        </div>
        <div v-animate-on-scroll="'hero-image'">
          <img loading="lazy" src="/hero-img.webp" alt="hero image" />
        </div>
      </div>
    </div>
    <div class="upcoming-highlight-wrapper">
      <div class="upcoming-highlights">
        <div class="highlights-intro">
          <div v-animate-on-scroll="'highlight-intro-header'">
            <h2>Upcoming Highlights</h2>
            <p>Check out these can't-miss events happening soon on campus.</p>
          </div>
          <RouterLink to="/discover">
            <button class="explore-btn">
              Explore More Events <span><ArrowUpBlue /></span>
            </button>
          </RouterLink>
        </div>
        <div class="skeleton" v-if="!eventValue.length >= 1">
          <SkeletonLoader v-for="i in 3" :key="i" />
        </div>
        <div v-animate-on-scroll="'event-cards'">
          <EventsCard v-if="eventValue.length >= 1" :events="eventValue.slice(0, 3)" />
        </div>
        <RouterLink to="/discover">
          <button class="explore-btn explore-btn-mobile">
            Explore More Events <span><ArrowUpBlue /></span>
          </button>
        </RouterLink>
      </div>
    </div>
    <div v-animate-on-scroll="'browse-by-category'">
      <h2>Browse by Category</h2>
      <div class="categories">
        <button class="category" v-for="(category, i) in categories" :key="i">
          <div class="category-icon">
            <img loading="lazy" :src="category.icon" alt="" />
          </div>
          <p>{{ category.category }}</p>
        </button>
      </div>
    </div>
    <div class="how-univent-work-wrapper">
      <div v-animate-on-scroll="'how-univent-work'">
        <h2 v-animate-on-scroll="'h2'">How UniVent Works</h2>
        <div class="">
          <div v-animate-on-scroll="'process'">
            <div class="">
              <SearchingIcon />
              <div class="">
                <h4>DISCOVER</h4>
                <p>Find events tailored to your interests.</p>
              </div>
            </div>
            <div class="">
              <SaveIcon />
              <div class="">
                <h4>SAVE</h4>
                <p>Keep track of events you don’t want to miss.</p>
              </div>
            </div>
            <div class="">
              <JoinIcon />
              <div class="">
                <h4>JOIN IN</h4>
                <p>Attend, connect with others, and enjoy!</p>
              </div>
            </div>
          </div>
          <div v-animate-on-scroll="'img'">
            <img loading="lazy" src="/uni-event.webp" alt="" />
          </div>
        </div>
      </div>
    </div>
    <!-- <div class="submit-event-section"></div> -->
    <div v-animate-on-scroll="'carousel'">
      <div
        class="carousel-track"
        :style="{
          transform: univentStore.isAuthenticated
            ? `translateX(-${0}%)`
            : `translateX(-${currentIndex * 100}%)`,
        }"
      >
        <div
          :class="['carousel-card', `carousel-card-${i}`]"
          :style="{ display: univentStore.isAuthenticated && i == 1 ? 'none' : 'flex' }"
          v-for="(card, i) in checkAuthenticatedUser"
          :key="i"
        >
          <div class="content">
            <h3>{{ card.title }}</h3>
            <button @click="pushToSubmitOrSignup(i)">{{ card.btnContent }}</button>
          </div>
          <div class="">
            <component :is="card.logo" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  margin-bottom: 70px;
}
.skeleton {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
}
.hero-section-container {
  overflow: hidden;
  background: url(/discorver-hero.webp) no-repeat center / cover;
}
.hero-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 90%;
  width: 100%;
  margin: 44px auto 64px;
  gap: 16px;
}
.hero-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
  opacity: 0;
  transform: translateX(-60px);
  transition: all 0.8s ease;
}
.hero-content.show {
  opacity: 1;
  transform: translateX(0px);
}
.hero-content h1 {
  font-weight: 700;
  font-style: Bold;
  font-size: 57px;
  line-height: 120%;
  letter-spacing: 0%;
  color: #fff;
  margin: 0;
}
.hero-content p {
  font-weight: 600;
  font-style: SemiBold;
  font-size: 19px;
  line-height: 120%;
  letter-spacing: 0%;
  /* color: #5a5a5a; */
  color: #d5d5d5;
  margin: 0;
}
.hero-content a {
  text-decoration: none;
}
.hero-content div {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* .hero-content div > button {
  width: 100%;
  flex: 1;
} */
.hero-explore-btn {
  padding: 16px;
  display: flex;
  width: 100%;
  gap: 4px;
  border-radius: 64px;
  font-weight: 600;
  color: #fff;
  align-items: center;
  background-color: #1969fe;
  border: 1px solid #1969fe;
  height: 50px;
  font-size: 19px;
  cursor: pointer;
}
.hero-explore-btn span {
  display: flex;
  font-size: 15px;
}
.hero-post-btn {
  padding: 16px 20px;
  display: flex;
  font-size: 19px;
  gap: 4px;
  border-radius: 64px;
  font-weight: 600;
  /* color: #000; */
  color: #eaeaea;
  align-items: center;
  background-color: transparent;
  /* border: 1px solid #000; */
  cursor: pointer;
  border: 1px solid #eaeaea;
  height: 50px;
}
.hero-image {
  max-width: 612px;
  width: 100%;
  border: 10px solid #ffffff;
  border-radius: 24px;
  opacity: 0;
  transform: translateX(60px);
  transition: all 0.8s ease;
}
.hero-image.show {
  opacity: 1;
  transform: translateX(0px);
}
.hero-image img {
  width: 100%;
}
.upcoming-highlight-wrapper {
  background-color: #f4f4f4;
}
.upcoming-highlights {
  display: flex;
  flex-direction: column;
  gap: 55px;
  max-width: 90%;
  width: 100%;
  padding: 64px 0;
  margin: 0 auto;
}
.highlight-intro-header {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity 0.8s ease,
    transform 0.8s ease;
}
.highlight-intro-header.show {
  opacity: 1;
  transform: translateY(0);
}
.highlights-intro {
  display: flex;
  justify-content: space-between;
}
.highlights-intro > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.highlights-intro a {
  text-decoration: none;
}
.highlights-intro h2 {
  font-weight: 700;
  font-size: 37px;
  line-height: 42px;
  letter-spacing: 0%;
  color: #000;
  margin: 0;
}
.highlights-intro p {
  font-weight: 600;
  color: #5a5a5a;
  font-size: 19px;
  line-height: 120%;
  letter-spacing: 0%;
  margin: 0;
}
.event-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  opacity: 0;
  transform: translateY(40px);
  transition: all 0.8s ease;
}
.event-cards.show {
  opacity: 1;
  transform: translateX(0px);
}
.explore-btn {
  display: flex;
  width: fit-content;
  background-color: #fff;
  color: #1969fe;
  border: 1px solid #bad2ff;
  padding: 14px 24px;
  border-radius: 30px;
  font-weight: 500;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  align-items: center;
  height: fit-content;
  gap: 5px;
  align-items: center;
  transition: all 0.5s;
}
.explore-btn-mobile {
  display: none;
}
.explore-btn:hover {
  background-color: #1969fe;
  color: #fff;
}
.browse-by-category {
  display: flex;
  flex-direction: column;
  gap: 48px;
  margin: 50px auto;
  max-width: 90%;
  width: 100%;
  opacity: 0;
  transform: translateX(-60px);
  transition: all 0.8s ease;
}
.browse-by-category.show {
  opacity: 1;
  transform: translateX(0px);
}
.browse-by-category h2,
.how-univent-work h2 {
  margin: 0;
  font-weight: 700;
  font-size: 37px;
  line-height: 42px;
  text-align: center;
}
.how-univent-work h2 {
  text-align: left;
}
.h2 {
  opacity: 0;
  transform: translateY(40px);
  transition: all 0.8s ease;
}
.h2.show {
  opacity: 1;
  transform: translateX(0px);
}
.categories {
  display: flex;
  justify-content: space-between;
}
.category {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  background-color: transparent;
  border: none;
}
.category p {
  margin: 0;
  font-weight: 600;
  font-size: 19px;
  line-height: 120%;
  color: #5a5a5a;
}
.category img {
  max-width: 100px;
  max-height: 100%;
  width: 100%;
}
.how-univent-work-wrapper {
  max-width: 90%;
  width: 100%;
  margin: 64px auto;
  position: relative;
}
.how-univent-work {
  display: flex;
  flex-direction: column;
  gap: 48px;
}
.how-univent-work > div {
  display: flex;
  width: 100%;
  z-index: -1;
}
.img {
  width: 100%;
  opacity: 0;
  transform: translateX(50px);
  transition: all 0.8s ease;
}
.img.show {
  opacity: 1;
  transform: translateX(-40px);
}
.img img {
  width: 105%;
}
.process {
  display: flex;
  max-width: 627px;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  opacity: 0;
  transform: translateX(-60px);
  transition: all 0.8s ease;
}
.process.show {
  opacity: 1;
  transform: translateX(0px);
}
.process > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: fit-content;
  margin: auto 0;
  gap: 48px;
  padding-right: 5px;
  border-right: 1px solid #eaeaea;
}
.process > div > div {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.process > div h4 {
  font-weight: 600;
  font-size: 19px;
}
.process > div p {
  font-weight: 500;
  font-size: 15px;
  line-height: 22.5px;
  color: #aaaaaa;
}
.process > div h4,
.process > div p {
  text-align: center;
  margin: 0;
}
/* ccc? */
.carousel {
  position: relative;
  max-width: 90%;
  width: 100%;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 10px;
  z-index: 1;
  opacity: 0;
  transform: translateY(60px);
  transition: all 0.8s ease;
}
.carousel.show {
  opacity: 1;
  transform: translateX(0px);
}

.carousel-track {
  display: flex;
  transition: transform 0.5s ease-in-out;
}

.carousel-card {
  min-width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 56px;
  border-radius: 32px;
  color: #fff;
}
.carousel-card .content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.carousel-card-0 {
  background-color: #ff2e92;
}
.carousel-card-1 {
  background-color: #6a59ce;
}
.carousel-card-1 h3 {
  color: #f0eefa;
  font-size: 46px;
  line-height: 120%;
  margin: 0;
}
.carousel-card-0 h3 {
  color: #ffeaf4;
  margin: 0;
  font-size: 46px;
  line-height: 120%;
}
.carousel-card-0 button {
  width: fit-content;
  margin: 0;
  color: #ff2e92;
  background-color: #ffc0de;
  padding: 16px 20px;
  border-radius: 64px;
  border: 1px solid #ffc0de;
  font-size: 19px;
  cursor: pointer;
}
.carousel-card-1 button {
  width: fit-content;
  margin: 0;
  color: #6a59ce;
  background-color: #f0eefa;
  padding: 16px 20px;
  border-radius: 64px;
  border: 1px solid #d2cdf0;
  font-size: 19px;
  cursor: pointer;
}

@media screen and (max-width: 500px) {
  .hero-section {
    flex-direction: column;
  }
  .hero-image {
    margin-top: 20px;
  }
  .event-cards {
    grid-template-columns: 1fr;
  }
  .categories {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .how-univent-work > div {
    flex-direction: column;
    gap: 20px;
  }
  .img.show {
    transform: translateX(0);
  }
  .img img {
    width: 100%;
  }
  .process > div h4 {
    font-size: 16px;
  }
  .skeleton {
    grid-template-columns: 1fr;
  }
  .hero-content {
    gap: 20px;
  }
  .hero-content h1 {
    font-size: 32px;
    font-weight: 600;
  }
  .hero-content p {
    font-size: 15px;
  }
  .hero-explore-btn,
  .hero-post-btn {
    font-size: 16px;
    padding: 14px;
    flex: 1;
    justify-content: center;
  }
  .upcoming-highlights {
    padding: 46px 0;
    margin: 0 auto;
    gap: 40px;
  }
  .highlights-intro > div {
    gap: 6px;
  }
  .upcoming-highlights > a {
    text-decoration: none;
    margin: auto;
  }
  .explore-btn {
    display: none;
    text-decoration: none;
  }
  .explore-btn-mobile {
    display: flex;
  }
  .browse-by-category h2,
  .how-univent-work h2 {
    font-size: 24px;
  }
  .highlights-intro h2 {
    font-size: 24px;
    line-height: 100%;
  }
  .highlights-intro p {
    font-size: 12px;
  }
  .process {
    flex-direction: column;
  }
  .process > div {
    border-right: none;
    padding: 0 0 10px;
    gap: 20px;
    border-bottom: 1px solid #eaeaea;
  }
  .carousel {
    margin-bottom: 110px;
  }
  .carousel-card {
    flex-direction: column;
    padding: 20px;
    gap: 20px;
  }
  .carousel-card-0 h3,
  .carousel-card-1 h3 {
    font-size: 24px;
  }
  .carousel-card-0 button,
  .carousel-card-1 button {
    padding: 14px 20px;
    font-size: 14px;
  }
  .hero-content div a,
  .hero-content div > button {
    width: 100%;
    display: flex;
    flex: 1;
  }
  .hero-content div > button {
    flex: 0.8;
    font-size: 15px;
  }
}
</style>
