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
