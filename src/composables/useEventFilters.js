import { ref } from 'vue'
import { supabase } from '@/supabase'
// import { useRequestedEvents } from './useRequestedEvents'
// import { useUniventStore } from '@/stores/counter'

// const { fetchRequestedAndEvents } = useRequestedEvents()

export function useEventFilters() {
  const loading = ref(false)
  const noEvent = ref(false)
  const filter = ref([])

  async function filterUpcomingEventOnlyAndInterested(events) {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      return events.map((e) => ({ ...e, is_interest: false }))
    }

    const userId = data.session.user.id

    const { data: interested_events, error: interestedError } = await supabase
      .from('interested_events')
      .select('event_id')
      .eq('user_id', userId)

    if (interestedError) {
      console.error('Error fetching interested events:', interestedError)
      return events.map((e) => ({ ...e, is_interest: false }))
    }

    const interestedId = new Set(interested_events.map((e) => e.event_id))

    return events.map((e) => ({
      ...e,
      is_interest: interestedId.has(e.id),
    }))
  }

  // async function handleFilters(filters) {
  //   const univentStore = useUniventStore()
  //   loading.value = true

  //   try {
  //     // univentStore.currentPage = 1
  //     univentStore.activeFilters = filters
  //     const result = await fetchRequestedAndEvents(univentStore.currentPage, filters)
  //     univentStore.pageSum = []
  //     for (let i = 1; i <= result.pagesNo; i++) {
  //       univentStore.pageSum.push(i)
  //     }
  //     const upcomingEventArray = await filterUpcomingEventOnlyAndInterested(result.events)
  //     filter.value = upcomingEventArray
  //     console.log(toRaw(result))
  //     noEvent.value = filter.value.length === 0

  //     univentStore.pageCount = result.pagesNo
  //   } catch (err) {
  //     console.error('Error filtering events:', err)
  //     filter.value = []
  //     noEvent.value = true
  //     univentStore.pageCount = 0
  //   } finally {
  //     loading.value = false
  //   }
  // }

  return {
    filter,
    loading,
    noEvent,
    // handleFilters,
    filterUpcomingEventOnlyAndInterested,
  }
}
