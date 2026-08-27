import { supabase } from '@/supabase'
import { ref } from 'vue'
import { useUniventStore } from '@/stores/counter'

import {
  saveEvents,
  getEvents,
  clearEvents,
  setLastSync,
} from '@/services/eventDB'

export const useRequestedEvents = () => {
  const univentStore = useUniventStore()
  const perPage = ref(15)

  /**
   * Get today's date in YYYY-MM-DD format
   */
  const getToday = () => {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Check if an event is still upcoming.
   *
   * This mirrors your Supabase query:
   *
   * end_date >= today
   * OR
   * end_date is null AND date >= today
   * OR
   * date is null
   */
  const isUpcomingEvent = (event) => {
    const today = getToday()

    if (event.end_date) {
      return event.end_date >= today
    }

    if (!event.end_date && event.date) {
      return event.date >= today
    }

    if (!event.date) {
      return true
    }

    return false
  }

  /**
   * Apply filters locally when offline.
   */
  const applyFilters = (events, filters = {}) => {
    let filteredEvents = [...events]

    // Only accepted events
    filteredEvents = filteredEvents.filter(
      (event) => event.event_state === 'accepted',
    )

    // Only upcoming events
    filteredEvents = filteredEvents.filter(isUpcomingEvent)

    /**
     * CATEGORY
     */
    if (filters.category && filters.category.length) {
      filteredEvents = filteredEvents.filter((event) => {
        if (!event.category) return false

        // category might be an array
        if (Array.isArray(event.category)) {
          return event.category.some((category) =>
            filters.category.includes(category),
          )
        }

        // fallback if category is a string
        return filters.category.some((category) =>
          String(event.category)
            .toLowerCase()
            .includes(String(category).toLowerCase()),
        )
      })
    }

    /**
     * LOCATION
     */
    if (filters.location && filters.location.length) {
      filteredEvents = filteredEvents.filter((event) => {
        if (!event.location) return false

        return filters.location.some((location) =>
          event.location
            .toLowerCase()
            .includes(location.toLowerCase()),
        )
      })
    }

    /**
     * FACULTY
     */
    if (filters.faculty && filters.faculty.length) {
      filteredEvents = filteredEvents.filter((event) => {
        if (!event.faculty) return false

        return filters.faculty.some((faculty) =>
          event.faculty
            .toLowerCase()
            .includes(faculty.toLowerCase()),
        )
      })
    }

    /**
     * PRICE
     */
    if (filters.price === 'below 2000') {
      filteredEvents = filteredEvents.filter(
        (event) => Number(event.price) <= 2000,
      )
    }

    if (filters.price === 'between 2000 and 5000') {
      filteredEvents = filteredEvents.filter((event) => {
        const price = Number(event.price)

        return price > 2000 && price < 5000
      })
    }

    if (filters.price === 'above 5000') {
      filteredEvents = filteredEvents.filter(
        (event) => Number(event.price) > 5000,
      )
    }

    /**
     * DATE
     */
    if (filters.date) {
      const today = new Date()

      if (filters.date === 'today') {
        const formattedToday = getToday()

        filteredEvents = filteredEvents.filter(
          (event) => event.date === formattedToday,
        )
      }

      if (filters.date === 'this week') {
        const weekFirstDay = new Date(today)

        weekFirstDay.setDate(
          today.getDate() - today.getDay(),
        )

        const weekLastDay = new Date(weekFirstDay)

        weekLastDay.setDate(
          weekFirstDay.getDate() + 6,
        )

        const formattedFirstWeekDay =
          weekFirstDay.toISOString().split('T')[0]

        const formattedLastWeekDay =
          weekLastDay.toISOString().split('T')[0]

        filteredEvents = filteredEvents.filter((event) => {
          if (!event.date) return false

          return (
            event.date >= formattedFirstWeekDay &&
            event.date <= formattedLastWeekDay
          )
        })
      }

      if (filters.date === 'this month') {
        const firstDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
        )
          .toISOString()
          .split('T')[0]

        const lastDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
        )
          .toISOString()
          .split('T')[0]

        filteredEvents = filteredEvents.filter((event) => {
          if (!event.date) return false

          return (
            event.date >= firstDayOfMonth &&
            event.date <= lastDayOfMonth
          )
        })
      }

      /**
       * Specific date
       */
      if (
        filters.date !== 'today' &&
        filters.date !== 'this week' &&
        filters.date !== 'this month'
      ) {
        filteredEvents = filteredEvents.filter(
          (event) => event.date === filters.date,
        )
      }
    }

    /**
     * SEARCH
     */
    if (filters.searchInput) {
      const search = filters.searchInput.toLowerCase()

      filteredEvents = filteredEvents.filter((event) =>
        event.event_title
          ?.toLowerCase()
          .includes(search),
      )
    }

    return filteredEvents
  }

  /**
   * Paginate events locally.
   */
  const paginateEvents = (events, page = 1) => {
    const from = (page - 1) * perPage.value
    const to = from + perPage.value

    const pagesNo = Math.ceil(
      events.length / perPage.value,
    )

    return {
      events: events.slice(from, to),
      allEvents: events,
      count: events.length,
      pagesNo,
    }
  }

  /**
   * Get the currently logged-in user's ID.
   *
   * We do not cache auth requests.
   */
  const getCurrentUserId = async () => {
    try {
      const {
        data: sessionData,
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error(
          'Failed to get session:',
          error,
        )

        return null
      }

      return sessionData?.session?.user?.id || null
    } catch (error) {
      console.error(
        'Session error:',
        error,
      )

      return null
    }
  }

  /**
   * Get the user's interested events.
   *
   * If this request fails while offline,
   * we simply return null and display
   * events without personalized ordering.
   */
  const getUserInterests = async (userId) => {
    if (!userId) return []

    try {
      const {
        data: profileData,
        error,
      } = await supabase
        .from('profile')
        .select('interested_events')
        .eq('id', userId)
        .single()

      if (error) {
        throw error
      }

      return (
        profileData?.interested_events || []
      )
    } catch (error) {
      console.warn(
        'Could not fetch user interests:',
        error,
      )

      return []
    }
  }

  /**
   * Reorder events based on user interests.
   */
  const orderEventsByInterest = (
    events,
    interestedEvents = [],
  ) => {
    if (
      !interestedEvents ||
      interestedEvents.length === 0
    ) {
      return events
    }

    const firstWord = interestedEvents.map(
      (item) => item.split(' ')[0],
    )

    const matching = events.filter((event) => {
      if (!event.category) return false

      return firstWord.some((word) => {
        if (Array.isArray(event.category)) {
          return event.category.includes(word)
        }

        return String(event.category).includes(word)
      })
    })

    const notMatching = events.filter((event) => {
      if (!event.category) return true

      return !firstWord.some((word) => {
        if (Array.isArray(event.category)) {
          return event.category.includes(word)
        }

        return String(event.category).includes(word)
      })
    })

    return [
      ...matching,
      ...notMatching,
    ]
  }

  /**
   * Download all base events from Supabase
   * and save them to IndexedDB.
   *
   * This is what runs when the app starts.
   */
  const syncEvents = async () => {
    if (!navigator.onLine) {
      return []
    }

    const today = getToday()

    const {
      data,
      error,
    } = await supabase
      .from('events')
      .select('*')
      .eq('event_state', 'accepted')
      .or(
        `and(end_date.gte.${today}),and(end_date.is.null,date.gte.${today}),date.is.null`,
      )

    if (error) {
      throw error
    }

    /**
     * Replace old cached event data
     * with fresh event data.
     */
    await clearEvents()

    await saveEvents(data || [])

    await setLastSync()

    return data || []
  }

  /**
   * Automatically sync events when
   * the application starts.
   */
  const syncEventsInBackground = async () => {
    if (!navigator.onLine) {
      console.log(
        'Offline: skipping event sync',
      )

      return
    }

    try {
      await syncEvents()

      console.log(
        'Events synced successfully',
      )
    } catch (error) {
      console.error(
        'Background event sync failed:',
        error,
      )
    }
  }

  /**
   * Get events from IndexedDB and
   * process them using local filters.
   */
  const getCachedEvents = async (
    page = 1,
    filters = {},
  ) => {
    const cachedEvents =
      await getEvents()

    if (!cachedEvents.length) {
      throw new Error(
        'No offline events available yet.',
      )
    }

    const filteredEvents =
      applyFilters(
        cachedEvents,
        filters,
      )

    const paginatedEvents =
      paginateEvents(
        filteredEvents,
        page,
      )

    return {
      success: true,
      requested_event: [],
      ...paginatedEvents,
      source: 'offline',
    }
  }

  /**
   * Main function used by DiscoverView.
   *
   * Flow:
   *
   * ONLINE
   * → Supabase
   * → Save events to IndexedDB
   * → Return fresh events
   *
   * OFFLINE
   * → IndexedDB
   *
   * NETWORK FAILURE
   * → IndexedDB fallback
   */
  const fetchRequestedAndEvents = async (
    page = 1,
    filters = {},
  ) => {
    try {
      /**
       * OFFLINE
       */
      if (!navigator.onLine) {
        const cachedResult =
          await getCachedEvents(
            page,
            filters,
          )

        univentStore.pageCount =
          cachedResult.pagesNo

        return cachedResult
      }

      /**
       * ONLINE
       */

      const today = getToday()

      const {
        data: requested_event,
        error: reqError,
      } = await supabase
        .from('events')
        .select(
          'id,created_at,event_title,category,time,date,description,location,image_url,price,free_or_paid,link_to_register,end_date,capacity,event_format,requires_registration,user_id,user_email,external_registration_link,faculty',
        )
        .eq(
          'event_state',
          'pending',
        )

      let query = supabase
        .from('events')
        .select('*', {
          count: 'exact',
        })
        .eq(
          'event_state',
          'accepted',
        )
        .or(
          `and(end_date.gte.${today}),and(end_date.is.null,date.gte.${today}),date.is.null`,
        )

      /**
       * CATEGORY
       */
      if (
        filters.category &&
        filters.category.length
      ) {
        query = query.overlaps(
          'category',
          filters.category,
        )
      }

      /**
       * LOCATION
       */
      if (
        filters.location &&
        filters.location.length
      ) {
        query = query.or(
          filters.location
            .map(
              (location) =>
                `location.ilike.%${location}%`,
            )
            .join(','),
        )
      }

      /**
       * FACULTY
       */
      if (
        filters.faculty &&
        filters.faculty.length
      ) {
        query = query.or(
          filters.faculty
            .map(
              (faculty) =>
                `faculty.ilike.%${faculty}%`,
            )
            .join(','),
        )
      }

      /**
       * PRICE
       */
      if (
        filters.price ===
        'below 2000'
      ) {
        query = query.lte(
          'price',
          2000,
        )
      }

      if (
        filters.price ===
        'between 2000 and 5000'
      ) {
        query = query
          .gt('price', 2000)
          .lt('price', 5000)
      }

      if (
        filters.price ===
        'above 5000'
      ) {
        query = query.gt(
          'price',
          5000,
        )
      }

      /**
       * DATE
       */
      if (filters.date) {
        if (
          filters.date === 'today'
        ) {
          query = query.eq(
            'date',
            getToday(),
          )
        } else if (
          filters.date === 'this week'
        ) {
          const now = new Date()

          const weekFirstDay =
            new Date(now)

          weekFirstDay.setDate(
            now.getDate() -
              now.getDay(),
          )

          const weekLastDay =
            new Date(
              weekFirstDay,
            )

          weekLastDay.setDate(
            weekFirstDay.getDate() +
              6,
          )

          const formattedFirstWeekDay =
            weekFirstDay
              .toISOString()
              .split('T')[0]

          const formattedLastWeekDay =
            weekLastDay
              .toISOString()
              .split('T')[0]

          query = query
            .gte(
              'date',
              formattedFirstWeekDay,
            )
            .lte(
              'date',
              formattedLastWeekDay,
            )
        } else if (
          filters.date ===
          'this month'
        ) {
          const now = new Date()

          const firstDayOfMonth =
            new Date(
              now.getFullYear(),
              now.getMonth(),
              1,
            )
              .toISOString()
              .split('T')[0]

          const lastDayOfMonth =
            new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              0,
            )
              .toISOString()
              .split('T')[0]

          query = query
            .gte(
              'date',
              firstDayOfMonth,
            )
            .lte(
              'date',
              lastDayOfMonth,
            )
        } else {
          query = query.eq(
            'date',
            filters.date,
          )
        }
      }

      /**
       * SEARCH
       */
      if (filters.searchInput) {
        query = query.ilike(
          'event_title',
          `%${filters.searchInput}%`,
        )
      }

      const {
        data: events,
        error: eventError,
        count,
      } = await query

      if (
        reqError ||
        eventError
      ) {
        throw (
          reqError ||
          eventError
        )
      }

      /**
       * IMPORTANT:
       *
       * We save only accepted event data.
       *
       * This gives us an offline copy
       * of the event list.
       */
      if (events?.length) {
        await clearEvents()

        await saveEvents(events)

        await setLastSync()
      }

      /**
       * Calculate pages
       */
      univentStore.pageCount =
        Math.ceil(
          count /
            perPage.value,
        )

      /**
       * Get logged-in user
       */
      const userId =
        await getCurrentUserId()

      /**
       * No logged-in user
       */
      if (!userId) {
        const paginatedEvents =
          paginateEvents(
            events || [],
            page,
          )

        return {
          success: true,
          requested_event:
            requested_event || [],
          ...paginatedEvents,
          source: 'online',
        }
      }

      /**
       * Logged-in user:
       * get interests and reorder events
       */
      const interestedEvents =
        await getUserInterests(
          userId,
        )

      const orderedEvents =
        orderEventsByInterest(
          events || [],
          interestedEvents,
        )

      const paginatedEvents =
        paginateEvents(
          orderedEvents,
          page,
        )

      return {
        success: true,
        requested_event:
          requested_event || [],
        ...paginatedEvents,
        source: 'online',
      }
    } catch (err) {
      console.error(
        'fetchRequestedAndEvents error:',
        err,
      )

      /**
       * NETWORK/API FAILED
       *
       * Try IndexedDB before
       * returning an error.
       */
      try {
        const cachedResult =
          await getCachedEvents(
            page,
            filters,
          )

        univentStore.pageCount =
          cachedResult.pagesNo

        return {
          ...cachedResult,
          source: 'cache',
        }
      } catch (cacheError) {
        console.error(
          'IndexedDB fallback failed:',
          cacheError,
        )

        return {
          success: false,
          error:
            err?.message ||
            'Failed to load events',
        }
      }
    }
  }

  return {
    fetchRequestedAndEvents,
    syncEvents,
    syncEventsInBackground,
  }
}

// import { supabase } from '@/supabase'
// import { ref } from 'vue'
// import { useUniventStore } from '@/stores/counter'
// import {
//   saveEvents,
//   clearEvents,
//   getEvents,
//   setLastSync,
// } from '@/services/eventDB'

// const cachedEvents = await getEvents()

// if (!navigator.onLine && cachedEvents.length > 0) {
//   // Work entirely from IndexedDB
// }

// export const useRequestedEvents = () => {
//   const today = new Date().toISOString().split('T')[0]
//   const univentStore = useUniventStore()
//   const perPage = ref(15)

//   const fetchRequestedAndEvents = async (page = 1, filters = {}) => {
//     const from = (page - 1) * perPage.value
//     const to = from + perPage.value - 1

//     try {
//       const { data: requested_event, error: reqError } = await supabase
//         .from('events')
//         .select(
//           'id,created_at, event_title, category, time, date,description,location,image_url, price,free_or_paid, link_to_register, end_date, capacity, event_format,requires_registration,user_id,user_email,external_registration_link,faculty',
//         )
//         .eq('event_state', 'pending')

//       // let query = supabase
//       //   .from('events')
//       //   .select('*', { count: 'exact' })
//       //   .gte('date', today)
//       //   .eq('event_state', 'accepted')

//       let query = supabase
//         .from('events')
//         .select('*', { count: 'exact' })
//         .eq('event_state', 'accepted')
//         .or(`and(end_date.gte.${today}),and(end_date.is.null,date.gte.${today}),date.is.null`)
//       if (filters.category && filters.category.length) {
//         query.overlaps('category', filters.category)
//       }
//       if (filters.location && filters.location.length) {
//         query = query.or(filters.location.map((l) => `location.ilike.%${l}%`).join(','))
//       }

//       if (filters.faculty && filters.faculty.length) {
//         query = query.or(filters.faculty.map((f) => `faculty.ilike.%${f}%`).join(','))
//       }

//       if (filters.price === 'below 2000') {
//         query = query.lte('price', 2000)
//       }

//       if (filters.price === 'between 2000 and 5000') {
//         query = query.gt('price', 2000).lt('price', 5000)
//       }

//       if (filters.price === 'above 5000') {
//         query = query.gt('price', 5000)
//       }

//       if (filters.date) {
//         if (filters.date === 'today') {
//           const today = new Date().toISOString().split('T')[0]
//           query = query.eq('date', today)
//         } else if (filters.date === 'this week') {
//           const today = new Date()
//           const weekFirstDay = new Date(today.setDate(today.getDate() - today.getDay()))
//           const weekLastDay = new Date(weekFirstDay)
//           weekLastDay.setDate(weekFirstDay.getDate() + 6)
//           const formattedLastWeekDay = weekLastDay.toISOString().split('T')[0]
//           const formattedFirstWeekDay = weekFirstDay.toISOString().split('T')[0]
//           query = query.gte('date', formattedFirstWeekDay).lte('date', formattedLastWeekDay)
//         } else if (filters.date === 'this month') {
//           const today = new Date()
//           const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
//             .toISOString()
//             .split('T')[0]
//           const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
//             .toISOString()
//             .split('T')[0]
//           query = query.gte('date', firstDayOfMonth).lte('date', lastDayOfMonth)
//         } else {
//           query = query.eq('date', filters.date)
//         }
//       }

//       if (filters.searchInput) {
//         query = query.ilike('event_title', `%${filters.searchInput}%`)
//       }

//       const { data: events, error: eventError, count } = await query

//       const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
//       const userId = sessionData?.session?.user?.id
//       univentStore.pageCount = Math.ceil(count / perPage.value)

//       if (reqError || eventError || sessionError) {
//         throw reqError || eventError || sessionError
//       }

//       if (!userId) {
//         console.log('noSession')
//         return {
//           success: true,
//           requested_event: requested_event || [],
//           events: events ? events.slice(from, to + 1) : [],
//           allEvents: events,
//           pagesNo: univentStore.pageCount,
//           count: count,
//         }
//       }

//       const { data: profile_data, error: profileError } = await supabase
//         .from('profile')
//         .select('interested_events')
//         .eq('id', userId)
//         .single()

//       if (profileError) {
//         throw profileError
//       }

//       const firstWord = profile_data?.interested_events?.map((item) => item.split(' ')[0]) || []

//       const matching = events.filter((evt) => firstWord.some((word) => evt.category.includes(word)))

//       const notMatching = events.filter(
//         (evt) => !firstWord.some((word) => evt.category.includes(word)),
//       )

//       const orderedEvent = [...matching, ...notMatching]

//       return {
//         success: true,
//         requested_event: requested_event || [],
//         events: orderedEvent.slice(from, to + 1),
//         pagesNo: univentStore.pageCount,
//         allEvents: orderedEvent,
//         // allEvents: events,
//         count: count,
//       }
//     } catch (err) {
//       console.error('fetchRequestedAndEvents error:', err)
//       return { success: false, error: err.message }
//     }
//   }

//   const syncEvents = async () => {
//   try {
//     const events = await fetchRequestedAndEvents()

//     await clearEvents()
//     await saveEvents(events)
//     await setLastSync()

//     return events
//   } catch (error) {
//     console.error('Event sync failed:', error)
//     throw error
//   }
// }

// const getOfflineFirstEvents = async () => {
//   const cachedEvents = await getEvents()

//   // Return cached data immediately if it exists
//   if (cachedEvents.length > 0) {
//     return cachedEvents
//   }

//   // No cached data — try Supabase
//   const freshEvents = await syncEvents()

//   return freshEvents
// }

// const syncEventsInBackground = async () => {
//   if (!navigator.onLine) return

//   try {
//     await syncEvents()
//     console.log('Events synced successfully')
//   } catch (error) {
//     console.error('Background event sync failed:', error)
//   }
// }

//   return {
//   fetchRequestedAndEvents,
//   getOfflineFirstEvents,
//   syncEvents,
//   syncEventsInBackground,
// }
// }

