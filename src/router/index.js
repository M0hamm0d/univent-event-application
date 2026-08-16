import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/supabase'
import { ensureSessionInit } from '@/composables/useSessionInit'
import HomeView from '@/views/HomeView.vue'

const authRequired = ['add event', 'interested', 'settings', 'manage attendees', 'event request']
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/discover',
      name: 'discover',
      component: () => import('../views/DiscoverView.vue'),
    },
    {
      path: '/update-password',
      name: 'update password',
      component: () => import('../views/UpdatePassword.vue'),
    },
    {
      path: '/interested',
      name: 'my interest',
      component: () => import('../views/MyInterest.vue'),
    },
    {
      path: '/email-verified',
      name: 'email verified',
      component: () => import('../views/EmailVerified.vue'),
    },
    {
      path: '/add-event',
      name: 'add event',
      component: () => import('../views/AddEvent.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingView.vue'),
    },
    {
      path: '/event-request',
      name: 'event request',
      component: () => import('../views/EventRequest.vue'),
    },
    {
      path: '/manage-attendees/:eventId',
      name: 'manage attendees',
      component: () => import('../views/ManageAttendees.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
})

router.beforeEach(async (to) => {
  await ensureSessionInit()

  if (!authRequired.includes(to.name)) return true
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return { name: 'home' }
  }
  return true
})

export default router
