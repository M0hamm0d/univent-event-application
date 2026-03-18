<script setup>
import ArrowUp from '@/components/icons/ArrowUp.vue'
import { useUniventStore } from '@/stores/counter'
import { useRouter } from 'vue-router'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import { EffectCoverflow, Pagination, Navigation } from 'swiper/modules'

const modules = [EffectCoverflow, Pagination, Navigation]

const links = [
  { name: 'Home', path: '/' },
  { name: 'Menu', path: '/menu' },
  { name: 'Process', path: '/process' },
  { name: 'About', path: '/about' },
  { name: 'Contact us', path: '/contact' },
]

const reviews = [
  {
    name: 'Jenny Wilson',
    location: 'Lagos, Nigeria',
    text: 'The donuts were so soft and the Zobo was the best I have ever had! Highly recommend Kirah.',
    image: '/user1.png',
  },
  {
    name: 'Esther Howard',
    location: 'Ilorin, Nigeria',
    text: 'I ordered small chops for my birthday and everyone loved them. The delivery was right on time.',
    image: '/user1.png',
  },
  {
    name: 'Wade Warren',
    location: 'Abuja, Nigeria',
    text: 'Kirah’s cakes are literally pieces of art. I almost didn’t want to eat it because it was so beautiful.',
    image: '/user1.png',
  },
]
const categories = [
  { name: 'Custom Cakes', itemCount: 12, icon: '/cake.webp', bgColor: '#EAF9FF' },
  { name: 'Small Chops', itemCount: 8, icon: '/chop-icon.webp', bgColor: '#F2EEFF' },
  { name: 'Pastries', itemCount: 15, icon: 'pastry.webp', bgColor: '#FFF2F5' },
  { name: 'Donuts', itemCount: 10, icon: '/donut-icon.webp', bgColor: '#F0FFF4' },
  { name: 'Zobo & Drinks', itemCount: 6, icon: 'zobo-icon.jpg', bgColor: '#FFF9E5' },
  { name: 'Parfaits', itemCount: 5, icon: '/parfait.webp', bgColor: '#FDF2FF' },
]

const orderSteps = [
  { title: 'Browse Menu', description: 'Select your favorite cakes, chops, or drinks.' },
  {
    title: 'Chat on WhatsApp',
    description: 'Your cart is sent directly to Kirah for confirmation.',
  },
  { title: 'Confirm & Pay', description: 'Secure your slot with a quick payment transfer.' },
  { title: 'Enjoy Your Treat', description: 'Fresh snacks delivered straight to your location.' },
]

const univentStore = useUniventStore()
const router = useRouter()

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
</script>
<template>
  <nav class="nav-wrapper">
    <div class="glass-header">
      <div class="logo">
        <img src="/kirah_treat_logo.png" alt="Logo" />
      </div>

      <ul class="nav-links">
        <li v-for="link in links" :key="link.name">
          <RouterLink :to="link.path" class="nav-item">
            {{ link.name }}
          </RouterLink>
        </li>
      </ul>

      <div class="nav-cta">
        <button class="join-btn">Order Now</button>
      </div>
    </div>
  </nav>
  <div class="container">
    <div class="hero-section-container">
      <div class="hero-section">
        <div v-animate-on-scroll="'hero-content'">
          <h1>Sweet Cravings & Savory Bites, Delivered.</h1>
          <p>
            From signature cakes and fluffy donuts to spicy small chops and refreshing Zobo. Kirah’s
            Treat brings the party to your taste buds.
          </p>
          <div class="">
            <RouterLink to="/discover">
              <button class="hero-explore-btn">
                <span>Explore the Menu</span>
                <span><ArrowUp /></span>
              </button>
            </RouterLink>
            <button class="hero-post-btn" @click="guardRoute('add-event')">
              Order via WhatsApp
            </button>
          </div>
        </div>
        <div v-animate-on-scroll="'hero-image'">
          <img loading="lazy" src="/kirah_treat.png" alt="Kirah's Treat Platter" />
        </div>
      </div>
    </div>

    <section class="featured-section">
      <div class="header-content">
        <h2 v-animate-on-scroll="'fade-up'">Our Fan <span class="">Favorites</span></h2>
      </div>

      <div class="treat-grid">
        <div class="treat-card chops-bg" v-animate-on-scroll="'card-pop'">
          <div class="icon-blob"><img src="/chop-icon.webp" alt="" /></div>
          <div class="decorative-shape circle-shape"></div>
          <h3>Spicy <br /><span class="special-font">Small Chops</span></h3>
          <p>The perfect mix of samosas, spring rolls, and puff-puff for your events.</p>
          <button class="order-btn">Order Now</button>
        </div>

        <div class="treat-card donuts-bg" v-animate-on-scroll="'card-pop'">
          <div class="icon-blob"><img src="/donut-icon.webp" alt="" /></div>
          <div class="decorative-shape squiggle-shape"></div>
          <h3>Glazed <br /><span class="special-font">Donuts</span></h3>
          <p>Soft, fluffy, and freshly glazed every morning. A true sweet treat.</p>
          <button class="order-btn">Order Now</button>
        </div>

        <div class="treat-card zobo-bg" v-animate-on-scroll="'card-pop'">
          <div class="icon-blob"><img src="/zobo-icon.jpg" alt="" /></div>
          <div class="decorative-shape dots-shape"></div>
          <h3>Chilled <br /><span class="special-font">Zobo Drink</span></h3>
          <p>Natural hibiscus blend with a hint of ginger. Refreshing and healthy.</p>
          <button class="order-btn">Order Now</button>
        </div>
      </div>
    </section>

    <section class="category-section">
      <div class="header-center">
        <p class="subtitle">Popular Category</p>
        <h2>Hot & Popular Categories</h2>
        <p class="description">
          Choose from our wide variety of freshly made treats, prepared with love and the finest
          ingredients.
        </p>
      </div>

      <div class="category-grid">
        <div
          v-for="(cat, index) in categories"
          :key="index"
          class="category-item"
          :style="{ backgroundColor: cat.bgColor }"
        >
          <div class="icon-wrapper">
            <img :src="cat.icon" :alt="cat.name" />
          </div>
          <div class="cat-text">
            <h3>{{ cat.name }}</h3>
            <span>{{ cat.itemCount }} Items</span>
          </div>
        </div>
      </div>
    </section>

    <section class="how-to-order">
      <div class="content-wrapper">
        <div class="visual-side" v-animate-on-scroll="'fade-right'">
          <img src="/order-process-visual.webp" alt="Ordering Process" />
        </div>

        <div class="steps-side" v-animate-on-scroll="'fade-left'">
          <p class="tagline">Simple Process</p>
          <h2>How to get your <span>Treats</span></h2>
          <p class="intro-text">
            Follow these four simple steps to get your favorite snacks delivered to your doorstep.
          </p>

          <div class="steps-container">
            <div v-for="(step, index) in orderSteps" :key="index" class="step-item">
              <div class="number-circle">
                {{ index + 1 }}
                <div v-if="index !== orderSteps.length - 1" class="connector-line"></div>
              </div>
              <div class="step-text">
                <h4>{{ step.title }}</h4>
                <p>{{ step.description }}</p>
              </div>
            </div>
          </div>

          <div class="button-group">
            <button class="btn-primary">Get Started</button>
            <button class="btn-outline">View Menu</button>
          </div>
        </div>
      </div>
    </section>
    <section class="testimonial-section">
      <div class="testimonial-header">
        <p>TESTIMONIALS</p>
        <h2>What Our <span>Clients</span> Say!</h2>
      </div>

      <swiper
        :effect="'coverflow'"
        :grabCursor="true"
        :centeredSlides="true"
        :slidesPerView="'auto'"
        :coverflowEffect="{
          rotate: 0,
          stretch: 0,
          depth: 100,
          modifier: 2,
          slideShadows: false,
        }"
        :pagination="true"
        :navigation="true"
        :modules="modules"
        class="mySwiper"
      >
        <swiper-slide v-for="(review, index) in reviews" :key="index">
          <div class="testimonial-card">
            <div class="quote-icon">“</div>
            <p class="review-text">{{ review.text }}</p>
            <div class="user-info">
              <!-- <img :src="review.image" :alt="review.name" /> -->
              <div class="user-details">
                <h4>{{ review.name }}</h4>
                <span>{{ review.location }}</span>
              </div>
            </div>
          </div>
        </swiper-slide>
      </swiper>
    </section>
    <footer class="footer-container">
      <div class="footer-main">
        <div class="footer-col brand-info">
          <div class="logo-wrapper">
            <img src="/kirah_treat_logo_trans.png" alt="Kirah's Treat Logo" />
          </div>
          <p>Bringing sweetness and savory delights to your doorstep with love.</p>
        </div>

        <div class="footer-col">
          <ul class="footer-links">
            <li><RouterLink to="/">Home</RouterLink></li>
            <li><RouterLink to="/about">About us</RouterLink></li>
            <li><RouterLink to="/menu">Our Menu</RouterLink></li>
            <li><RouterLink to="/contact">Contact</RouterLink></li>
            <li><RouterLink to="/testimonials">Testimonials</RouterLink></li>
          </ul>
        </div>

        <div class="footer-col contact-details">
          <p>(+234) 800-KIRAH-TREAT</p>
          <p>hello@kirahstreat.com</p>
        </div>

        <div class="footer-col address">
          <p>
            Available for Delivery Across <br />
            Ilorin, Kwara State, Nigeria.
          </p>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="bottom-content">
          <p>&copy; 2026 Kirah's Treat. All rights reserved.</p>
          <div class="social-icons">
            <a href="#"><i class="fab fa-linkedin"></i></a>
            <a href="#"><i class="fab fa-instagram"></i></a>
            <a href="#"><i class="fab fa-facebook"></i></a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
<style scoped>
.nav-wrapper {
  position: fixed;
  top: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 1000;
  padding: 0 20px;
}

.glass-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1100px;
  padding: 10px 15px;
  /* Glassmorphism core */
  background: rgba(255, 255, 255, 0.05); /* Very transparent */
  backdrop-filter: blur(15px); /* This creates the frosted glass look */
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1); /* Subtle white border */
  border-radius: 100px; /* Makes it pill-shaped */
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.logo img {
  height: 40px;
  width: 40px;
  border-radius: 50%;
}

.nav-links {
  display: flex;
  list-style: none;
  gap: 10px;
  margin: 0;
  padding: 0;
}

.nav-item {
  text-decoration: none;
  color: #fff;
  color: #7a4a3a;
  font-size: 14px;
  padding: 8px 18px;
  border-radius: 50px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border: 1px solid #7a4a3a;
  transition: all 0.3s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.join-btn {
  /* Gradient matching your Burnt Orange palette */
  background: linear-gradient(90deg, #f2994a 0%, #c05c3b 100%);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 50px;
  font-weight: 600;
  cursor: pointer;
  font-size: 15px;
  box-shadow: 0 4px 15px rgba(192, 92, 59, 0.3);
}

@media (max-width: 768px) {
  .nav-links {
    display: none; /* You'll need a mobile hamburger menu here later */
  }
}
/* hero section */
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  margin-bottom: 70px;
  background-color: #fdf8f0;
  font-family: Satoshi;
}
.skeleton {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
}
/* .hero-section-container {
  overflow: hidden;
  background: url(/discorver-hero.webp) no-repeat center / cover;
} */
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
  gap: 35px;
  opacity: 0;
  transform: translateX(-60px);
  transition: all 0.8s ease;
}
.hero-content.show {
  opacity: 1;
  transform: translateX(0px);
  width: 100%;
}
.hero-content h1 {
  font-weight: 700;
  font-style: Bold;
  font-size: 48px;
  line-height: 56px;
  letter-spacing: 0%;
  color: #5d2a18;
  margin: 0;
}
.hero-content p {
  font-weight: 600;
  font-style: SemiBold;
  font-size: 18px;
  line-height: 140%;
  letter-spacing: 0%;
  /* color: #5a5a5a; */
  color: #7a4a3a;
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
  background-color: #c05c3b;
  border: 1px solid #c05c3b;
  height: 50px;
  font-size: 19px;
  cursor: pointer;
}
.hero-explore-btn:hover {
  background-color: #a04a2f;
}
.hero-explore-btn span {
  display: flex;
  font-size: 15px;
}
.hero-post-btn {
  padding: 16px 20px;
  display: flex;
  font-size: 16px;
  gap: 4px;
  border-radius: 64px;
  font-weight: 600;
  /* color: #000; */
  color: #5d2a18;
  align-items: center;
  background-color: transparent;
  /* border: 1px solid #000; */
  cursor: pointer;
  border: 2px solid #5d2a18;
  height: 50px;
}
.hero-image {
  /* max-width: 612px; */
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
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(93, 42, 24, 0.15);
}

/* Featured Section */
.featured-section {
  padding: 40px 5% 80px;
  background-color: #fdf8f0;
}

.header-content h2 {
  font-size: 42px;
  color: #5d2a18;
  margin-bottom: 40px;
}

.header-content h2 span,
.special-font {
  font-style: italic;
  font-family: 'Playfair Display', serif; /* Or any serif font */
  color: #c05c3b;
}
.special-font {
  color: #5d2a18;
}

.treat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.treat-card {
  position: relative;
  padding: 30px 30px;
  border-radius: 48px;
  overflow: hidden;
  /* height: 400px; */
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  transition: transform 0.3s ease;
}

.treat-card:hover {
  transform: translateY(-10px);
}

/* Background Colors based on your Inspo but for Food */
.chops-bg {
  background-color: #f2d5c4;
} /* Soft Terracotta */
.donuts-bg {
  background-color: #e6daf0;
} /* Soft Lavender (fits donuts) */
.zobo-bg {
  background-color: #ffe5a3;
} /* Soft Yellow */

.icon-blob {
  /* position: absolute;
  top: 30px;
  left: 30px; */
  /* background: white; */
  /* padding: 15px; */
  /* max-height: max-content; */
  height: 250px;
  /* width: 90%; */
  border-radius: 20px;
  margin-bottom: 15px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
}
.icon-blob img {
  /* width: 40px;
  height: 40px; */
  width: 100%;
  height: 100%;
  border-radius: 18px;
  /* object-fit: cover; */
}

/* Decorative Shapes like your Image */
.decorative-shape {
  position: absolute;
  top: 20px;
  right: -10px;
  width: 120px;
  height: 120px;
  opacity: 0.2;
}

.circle-shape {
  border: 15px solid #5d2a18;
  border-radius: 50%;
}

.treat-card h3 {
  font-size: 28px;
  color: #5d2a18;
  margin-bottom: 12px;
  line-height: 1.2;
  margin-top: 0;
}

.treat-card p {
  color: #5d2a18;
  opacity: 0.8;
  font-size: 16px;
  margin-bottom: 24px;
  margin-top: 0;
}

.order-btn {
  background: #5d2a18;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 30px;
  width: fit-content;
  cursor: pointer;
  font-weight: 600;
  font-family: Satoshi;
}

/* Category Section */
.category-section {
  padding: 60px 10%;
  background-color: #fdf8f0; /* Matching our theme */
  text-align: center;
}

.header-center {
  margin-bottom: 50px;
}

.subtitle {
  color: #c05c3b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 14px;
}

.header-center h2 {
  font-size: 36px;
  color: #5d2a18;
  margin: 10px 0;
}

.description {
  max-width: 600px;
  margin: 0 auto;
  color: #7a4a3a;
  opacity: 0.8;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 3 columns as per inspo */
  gap: 20px;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 24px;
  border-radius: 12px;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.category-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(93, 42, 24, 0.08);
}

.icon-wrapper {
  background: white;
  width: 60px;
  height: 60px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
}

.icon-wrapper img {
  width: 45px;
  height: 45px;
  border-radius: 10px;
}

.cat-text {
  text-align: left;
}

.cat-text h3 {
  margin: 0;
  font-size: 18px;
  color: #5d2a18;
}

.cat-text span {
  font-size: 14px;
  color: #7a4a3a;
  opacity: 0.7;
}

/* Responsive for mobile */
@media (max-width: 992px) {
  .category-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .category-grid {
    grid-template-columns: 1fr;
  }
}

/* How to Order Section */
.how-to-order {
  padding: 80px 10%;
  background-color: #fdf2ee; /* A very light tint of orange/cream */
  background-color: #fdf8f0; /* A very light tint of orange/cream */
}

.content-wrapper {
  display: flex;
  align-items: center;
  gap: 60px;
}

.visual-side {
  flex: 1;
  border-radius: 10px;
}

.visual-side img {
  width: 100%;
  max-width: 500px;
  border-radius: 10px;
  filter: drop-shadow(0 20px 30px rgba(192, 92, 59, 0.2));
}

.steps-side {
  flex: 1;
}

.tagline {
  color: #c05c3b;
  font-weight: 700;
  font-size: 18px;
}

.steps-side h2 {
  font-size: 40px;
  color: #5d2a18;
  margin: 10px 0;
}

.steps-side h2 span {
  color: #c05c3b;
  font-style: italic;
}

.intro-text {
  color: #7a4a3a;
  margin-bottom: 40px;
  line-height: 1.6;
}

/* Timeline Logic */
.steps-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
  margin-bottom: 40px;
}

.step-item {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.number-circle {
  position: relative;
  min-width: 45px;
  height: 45px;
  background-color: #c05c3b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 700;
  font-size: 20px;
}

.connector-line {
  position: absolute;
  top: 45px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 30px;
  border-left: 2px dotted #c05c3b;
}

.step-text h4 {
  margin: 0;
  font-size: 20px;
  color: #5d2a18;
}

.step-text p {
  margin: 5px 0 0;
  font-size: 15px;
  color: #7a4a3a;
  opacity: 0.8;
}

/* Buttons */
.button-group {
  display: flex;
  gap: 15px;
}

.btn-primary {
  background: #c05c3b;
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(192, 92, 59, 0.3);
  font-family: Satoshi;
}

.btn-outline {
  background: transparent;
  color: #c05c3b;
  border: 2px solid #c05c3b;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: Satoshi;
}

@media (max-width: 900px) {
  .content-wrapper {
    flex-direction: column;
    text-align: center;
  }
  .step-item {
    text-align: left;
  }
  .button-group {
    justify-content: center;
  }
}
/* Testimonial Section */
.testimonial-section {
  padding: 80px 0;
  background-color: #fdf8f0;
  text-align: center;
}

.testimonial-header h2 {
  font-size: 36px;
  color: #5d2a18;
  margin-bottom: 40px;
}

/* Swiper specific styles */
.swiper {
  width: 100%;
  padding-top: 50px;
  padding-bottom: 50px;
}

.swiper-slide {
  background-position: center;
  background-size: cover;
  width: 450px; /* Adjust based on your design */
}

.testimonial-card {
  background: white;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(93, 42, 24, 0.1);
  text-align: left;
}

.quote-icon {
  font-size: 60px;
  color: #c05c3b;
  font-family: serif;
  line-height: 1;
}

.review-text {
  color: #7a4a3a;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 25px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.user-info img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}

.user-details h4 {
  margin: 0;
  color: #5d2a18;
}

.user-details span {
  font-size: 13px;
  color: #7a4a3a;
  opacity: 0.7;
}
/* Footer */
.footer-container {
  background-color: #fff;
  width: 100%;
  padding-top: 60px;
}

.footer-main {
  display: flex;
  justify-content: space-between;
  max-width: 90%;
  margin: 0 auto 60px;
  gap: 40px;
  flex-wrap: wrap;
}

.footer-col {
  flex: 1;
  min-width: 200px;
}

.logo-wrapper img {
  height: 50px;
  margin-bottom: 20px;
}

.brand-info p {
  color: #5d2a18;
  line-height: 1.6;
  font-size: 15px;
  max-width: 250px;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links li {
  margin-bottom: 12px;
}

.footer-links a {
  text-decoration: none;
  color: #7a4a3a;
  font-size: 15px;
  transition: color 0.3s;
}

.footer-links a:hover {
  color: #c05c3b;
}

.contact-details p,
.address p {
  color: #7a4a3a;
  font-size: 15px;
  margin-bottom: 12px;
}

/* Bottom Bar Styling */
.footer-bottom {
  background-color: #c05c3b; /* Your Burnt Orange */
  padding: 20px 0;
  color: #fff;
}

.bottom-content {
  max-width: 90%;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bottom-content p {
  margin: 0;
  font-size: 14px;
}

.social-icons {
  display: flex;
  gap: 20px;
  font-size: 20px;
}

.social-icons a {
  color: #fff;
  transition: opacity 0.3s;
}

.social-icons a:hover {
  opacity: 0.7;
}

@media (max-width: 768px) {
  .bottom-content {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
}
</style>
