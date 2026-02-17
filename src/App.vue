<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { onMounted, ref, watch } from 'vue'
import { supabase } from '@/supabase'
import { useUserProfile } from '@/composables/useUserProfile'
import ViewDetailsModal from './components/ViewDetailsModal.vue'
import { useUniventStore } from './stores/counter'
import SignUpModal from './components/SignUpModal.vue'
import LoginModal from './components/LoginModal.vue'
import DropdownIcon from './components/icons/DropdownIcon.vue'
import { useToast } from 'vue-toastification'
import { useAuth } from '@/composables/useAuth'
import router from './router'
import HomeBtn from './components/icons/HomeBtn.vue'
import SearchIcon from './components/icons/SearchIcon.vue'
import BookmarkIcon from './components/icons/BookmarkIcon.vue'
import RequestEvent from './components/icons/RequestEvent.vue'
import { useRoute } from 'vue-router'
// import UniventAssistance from './components/UniventAssistance.vue'
const route = useRoute()
const { fetchProfile } = useUserProfile()
let univentStore = useUniventStore()
const showDropdown = ref(false)
const toast = useToast()
const { logout } = useAuth(toast)

function handleLogout() {
  logout()
  router.push('/')
}

const fetchSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error fetching session:', error.message)
    return null
  }
  return data.session
}
const isAuthenticated = ref(null)
const activeNav = ref(null)

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
  if (univentStore.isAuthenticated) {
    activeNav.value = param
  }
}

watch(
  () => route.path,
  (newPath) => {
    if (newPath === '/' || newPath === '/discover') {
      activeNav.value = ''
    } else if (newPath.includes('add-event')) {
      activeNav.value = 'add-event'
    } else if (newPath.includes('interested')) {
      activeNav.value = 'interested'
    }
  },
  { immediate: true },
)

onMounted(async () => {
  const session = await fetchSession()
  univentStore.isAuthenticated = !!session?.user
  isAuthenticated.value = !!session?.user
  if (session?.user) {
    const result = await fetchProfile(session.user.id)
    univentStore.userProfile = result.data
  }
})
</script>

<template>
  <div class="app">
    <div class="new-home-page">
      <div
        class="viewDetailsModal"
        v-if="univentStore.viewDetailsModal"
        @click="univentStore.viewDetailsModal = !univentStore.viewDetailsModal"
      >
        <ViewDetailsModal />
      </div>
      <Transition name="close-login-modal">
        <div
          class="viewLoginModal"
          v-if="univentStore.signupModal"
          @click="univentStore.signupModal = !univentStore.signupModal"
        >
          <SignUpModal @close-btn="univentStore.signupModal = !univentStore.signupModal" />
        </div>
      </Transition>
      <Transition name="close-login-modal">
        <div
          class="viewLoginModal"
          v-if="univentStore.loginModal"
          @click="univentStore.loginModal = false"
        >
          <LoginModal @close-btn="univentStore.loginModal = false" />
        </div>
      </Transition>
      <div class="header">
        <RouterLink to="/">
          <div class="home-logo" @click="activeNav = ''">
            <img loading="lazy" src="/univentLogo.png" alt="" />
          </div>
        </RouterLink>
        <div class="home-nav">
          <ul>
            <RouterLink to="/discover">
              <li @click="activeNav = ''">Discover Event</li>
            </RouterLink>
            <li
              @click="guardRoute('interested')"
              :class="{ activeRoute: activeNav == 'interested' }"
            >
              My Interest
            </li>
            <li @click="guardRoute('add-event')" :class="{ activeRoute: activeNav == 'add-event' }">
              Add Events
            </li>
            <RouterLink
              to="/event-request"
              v-if="univentStore.userProfile?.user_email === 'masalami042@gmail.com'"
            >
              <li @click="activeNav = ''">Event Requests</li>
            </RouterLink>
            <!-- <li>School Calender</li> -->
          </ul>
        </div>
        <div class="signup-login-btn" v-if="!univentStore.isAuthenticated">
          <button @click="univentStore.loginModal = true" class="login">Log In</button>
          <button class="sign-up" @click="univentStore.signupModal = true">Sign Up</button>
        </div>
        <div v-else>
          <div class="authenticated" v-if="!univentStore.userProfile?.profile_pics">
            <div class="icon" @click="showDropdown = !showDropdown">
              <span class="avatar">{{
                univentStore.userProfile?.user_name?.charAt(0).toUpperCase()
              }}</span>
              <DropdownIcon />
            </div>

            <div v-if="showDropdown" class="profile-dropdown">
              <RouterLink to="/settings" @click="showDropdown = !showDropdown">
                <div>Settings</div>
              </RouterLink>
              <div @click="handleLogout">Logout</div>
            </div>
          </div>
          <div v-else class="authenticated">
            <div class="icon" @click="showDropdown = !showDropdown">
              <img
                loading="lazy"
                :src="univentStore.userProfile?.profile_pics"
                alt="profile"
                class="avatar-img"
              />
              <DropdownIcon />
            </div>

            <div v-if="showDropdown" class="profile-dropdown">
              <RouterLink to="/settings" @click="showDropdown = !showDropdown">
                <div>Settings</div>
              </RouterLink>
              <div @click="handleLogout">Log out</div>
            </div>
          </div>
        </div>
      </div>
      <RouterView />
      <div class="mobileNav">
        <RouterLink to="/">
          <div class="">
            <HomeBtn />
            <p>Home</p>
          </div>
        </RouterLink>
        <RouterLink to="/discover">
          <div class="">
            <SearchIcon />
            <p>Discover Events</p>
          </div>
        </RouterLink>
        <div @click="guardRoute('interested')" :class="{ activeRoute: activeNav == 'interested' }">
          <BookmarkIcon />
          <p>My Interest</p>
        </div>
        <div @click="guardRoute('add-event')" :class="{ activeRoute: activeNav == 'add-event' }">
          <RequestEvent />
          <p>Request Event</p>
        </div>
      </div>
    </div>
    <div class="univent-assistance">
      <!-- <UniventAssistance /> -->
    </div>
  </div>
</template>

<style scoped>
.mobileNav {
  display: none;
}
.header {
  z-index: 100;
}
.authenticated {
  display: inline-block;
  align-items: center;
  gap: 5px;
  position: relative;
  cursor: pointer;
}
.authenticated > .icon {
  display: flex;
  align-items: center;
}
.profile-dropdown {
  width: 180px;
  position: absolute;
  border: 1px solid #eaeaea;
  background: #ffffff;
  box-shadow: 0px 10px 15px 0px #0000000d;
  right: 0;
  top: 50px;
  border-radius: 10px;
  z-index: 5;
  flex-direction: column;
}
.profile-dropdown div {
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 500;
  color: #5a5a5a;
  cursor: pointer;
}
.profile-dropdown div:hover {
  background-color: #f4f4f4;
  border-radius: 10px;
}
.avatar {
  width: 40px;
  height: 40px;
  background: #e8f0ff;
  color: #1969fe;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.login-modal {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  display: flex;
}
.close-login-modal-enter-active,
.close-login-modal-leave-active {
  transition: all 0.4s ease;
}
.close-login-modal-enter-from,
.close-login-modal-leave-to {
  opacity: 0;
  transform: translateY(500px);
}
.login-modal > div {
  display: flex;
  /* overflow: auto; */
  height: 90%;
}
/* ... */
.new-home-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-family: 'Geist', sans-serif;
  overflow-x: hidden;
  overflow-y: auto;
  /* background: url(/discorver-hero.webp) no-repeat center / cover; */
}
.univent-assistance {
  position: absolute;
  bottom: 50px;
  right: 50px;
  z-index: 100;
}
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  font-family: Satoshi;
  width: 100%;
  position: relative;
}
.viewDetailsModal,
.viewLoginModal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  width: 100%;
  height: 100%;
  z-index: 101;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header {
  max-width: 90%;
  width: 100%;
  margin: 20px auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.home-nav ul {
  display: flex;
  margin: 0;
  padding: 0;
  list-style-type: none;
  gap: 42px;
}
.home-nav li {
  font-weight: 500;
  color: #8c8c8c;
  transition: all 0.5s;
  cursor: pointer;
  font-size: 15px;
}
.home-nav li:hover {
  color: #000;
}
.signup-login-btn {
  display: flex;
  gap: 12px;
  align-items: center;
}
.login {
  padding: 16px 20px;
  border: none;
  display: flex;
  border-radius: 32px;
  outline: none;
  background: #eaeaea;
  color: #000;
  font-weight: 600;
  cursor: pointer;
}
.sign-up {
  padding: 16px 20px;
  border: none;
  border-radius: 32px;
  outline: none;
  background-color: #1969fe;
  cursor: pointer;
  color: #fff;
  font-weight: 600;
}
.mobile-header {
  display: none;
}
.mobile-header div,
.nav .header-logo {
  width: 130px;
}
.nav div {
  margin-bottom: 20px;
}
.mobile-header img,
.nav img {
  width: 100%;
}
.auth-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  /* background: #f2f5f9; */

  background: #f1f1f1;
}
.home-content {
  flex: 1;
  display: flex;
  height: 100vh;
  overflow: hidden;
}
/* Modal Start */
.modal-backdrop {
  position: fixed;
  font-family: Satoshi;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  background-color: rgba(0, 0, 0, 0.7); /* transparent black */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}
.sideBarOpen {
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}
.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 426px;
  width: 100%;
  color: #000;
}
/* Modal component */
/* Modal ends */
.sidebar {
  width: 200px;
  flex-shrink: 0;
  background-color: white;
  border-right: 1px solid #c9c9c9;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 20px;
  position: relative;
}
.logo {
  font-size: 32px;
  font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  padding: 0;
  margin: 0;
}
.navigation {
  display: flex;
  gap: 10px;
  align-items: center;
}
a {
  color: black;
  text-decoration: none;
}
a:hover {
  transition: 0.3s;
}
.router-link-active,
.active {
  /* background-color: #e8e8e8; */
  color: #1969fe;
  /* color: black; */
  font-weight: bold;
  /* border-radius: 5px; */
}
.router-link-active > li,
.home-nav .activeRoute {
  color: #1969fe;
  text-decoration: underline;
}
.activeRoute {
  color: #1969fe;
}
.router-link-active > li:hover {
  color: #1969fe;
  text-decoration: underline;
}
.home-explore {
  display: flex;
  gap: 10px;
}
.header-input {
  background-color: #f1f1f1;
  padding: 5px;
  width: 300px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.header-input input {
  border: none;
  outline: none;
  background-color: #f1f1f1;
}
.main {
  flex: 1;
  overflow-y: auto;
  background-color: #fdfdfd;
}
.nav {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.nav a {
  padding: 0 10px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: bold;
  color: #4a4a4a;
  outline: none;
  font-family: Satoshi;
}
.add-event {
  background-color: #0b99ff;
  color: #fff;
  text-align: center;
  padding: 10px;
  border-radius: 4px;
  font-weight: 600;
  width: 100%;
  border: none;
}
@media (max-width: 500px) {
  .home-nav {
    display: none;
  }
  .mobileNav {
    padding: 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    position: fixed;
    border-radius: 10px 10px 0 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background-color: #fff;
    box-shadow:
      0 2px 14px 4px rgba(0, 0, 0, 0.05),
      0 12px 24px -2px rgba(0, 0, 0, 0.08);
  }
  .mobileNav div {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* justify-items: center; */
    gap: 4px;
  }
  .mobileNav div svg {
    width: 21px;
    height: 21px;
    /* fill: #0b99ff;
    color: #0b99ff; */
  }
  .mobileNav p {
    margin: 0px;
    font-size: 12px;
  }
  .login {
    display: none;
  }
}
</style>
