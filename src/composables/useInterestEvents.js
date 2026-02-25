import { ref } from 'vue'
import { supabase } from '@/supabase'

export function useInterestedEvents(toast) {
  const interest = ref([])
  const active = ref('upcoming')
  const loading = ref(false)
  const perPage = ref(6)
  async function fetchInterest(page = 1, filters = {}) {
    const from = (page - 1) * perPage.value //0*2, 1*2
    const to = from + perPage.value //0+2, 2+2
    loading.value = true
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        interest.value = []
        return
      }
      let today = new Date().toISOString().split('T')[0]
      let query = supabase
        .from('interested_events')
        .select('id, event_id, events!inner(*)', { count: 'exact' })
        .eq('user_id', user.id)
      if (active.value === 'upcoming') {
        query = query.gte('events.date', today)
      }
      if (active.value === 'past') {
        query = query.lt('events.date', today)
      }
      if (filters.date) {
        if (filters.date === 'today') {
          query = query.eq('events.date', today)
        } else if (filters.date === 'this week') {
          const today = new Date()
          const weekFirstDay = new Date(today.setDate(today.getDate() - today.getDay()))
          const weekLastDay = new Date(weekFirstDay)
          weekLastDay.setDate(weekFirstDay.getDate() + 6)
          const formattedLastWeekDay = weekLastDay.toISOString().split('T')[0]
          const formattedFirstWeekDay = weekFirstDay.toISOString().split('T')[0]
          query = query
            .gte('events.date', formattedFirstWeekDay)
            .lte('events.date', formattedLastWeekDay)
        } else if (filters.date === 'this month') {
          const today = new Date()
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            .toISOString()
            .split('T')[0]
          const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            .toISOString()
            .split('T')[0]
          query = query.gte('events.date', firstDayOfMonth).lte('events.date', lastDayOfMonth)
        } else {
          query = query.eq('events.date', filters.date)
        }
      }
      if (filters.price == 'below 2000') {
        query = query.lt('events.price', 2000)
      }
      if (filters.price == 'between 2000 and 5000') {
        query = query.gte('events.price', 2000).lte('events.price', 5000)
      }
      if (filters.price == 'above 5000') {
        query = query.gt('events.price', 5000)
      }
      if (filters.category && filters.category.length > 0) {
        query = query.overlaps('events.category', filters.category)
      }
      if (filters.searchInput) {
        query = query.ilike('events.event_title', `%${filters.searchInput}%`)
      }
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
      const totalPageNo = Math.ceil(count / perPage.value)
      if (!error) {
        // Fetch registered events for the user and apply filters
        let regQuery = supabase
          .from('registered_events')
          .select('id, event_id, events!inner(*)', { count: 'exact' })
          .eq('user_id', user.id)
        if (active.value === 'upcoming') {
          regQuery = regQuery.gte('events.date', today)
        }
        if (active.value === 'past') {
          regQuery = regQuery.lt('events.date', today)
        }
        if (filters.date) {
          if (filters.date === 'today') {
            regQuery = regQuery.eq('events.date', today)
          } else if (filters.date === 'this week') {
            const todayObj = new Date()
            const weekFirstDay = new Date(todayObj.setDate(todayObj.getDate() - todayObj.getDay()))
            const weekLastDay = new Date(weekFirstDay)
            weekLastDay.setDate(weekFirstDay.getDate() + 6)
            const formattedLastWeekDay = weekLastDay.toISOString().split('T')[0]
            const formattedFirstWeekDay = weekFirstDay.toISOString().split('T')[0]
            regQuery = regQuery
              .gte('events.date', formattedFirstWeekDay)
              .lte('events.date', formattedLastWeekDay)
          } else if (filters.date === 'this month') {
            const todayObj = new Date()
            const firstDayOfMonth = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1)
              .toISOString()
              .split('T')[0]
            const lastDayOfMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() + 1, 0)
              .toISOString()
              .split('T')[0]
            regQuery = regQuery
              .gte('events.date', firstDayOfMonth)
              .lte('events.date', lastDayOfMonth)
          } else {
            regQuery = regQuery.eq('events.date', filters.date)
          }
        }
        if (filters.price == 'below 2000') {
          regQuery = regQuery.lt('events.price', 2000)
        }
        if (filters.price == 'between 2000 and 5000') {
          regQuery = regQuery.gte('events.price', 2000).lte('events.price', 5000)
        }
        if (filters.price == 'above 5000') {
          regQuery = regQuery.gt('events.price', 5000)
        }
        if (filters.category && filters.category.length > 0) {
          regQuery = regQuery.overlaps('events.category', filters.category)
        }
        if (filters.searchInput) {
          regQuery = regQuery.ilike('events.event_title', `%${filters.searchInput}%`)
        }
        const { data: registeredRows, error: regError } = await regQuery
          .order('created_at', { ascending: false })
          .range(from, to)
        let registeredEvents = []
        if (!regError && registeredRows) {
          registeredEvents = registeredRows.map((row) => ({ ...row, is_registered: true }))
        } else if (regError && regError.code !== 'PGRST116') {
          // console.error('Error fetching registered events:', regError)
        }
        // Merge interested and registered events, avoiding duplicates
        const allEventsMap = new Map()
        data.forEach((ev) => {
          allEventsMap.set(ev.event_id, { ...ev, is_interested: true })
        })
        registeredEvents.forEach((ev) => {
          if (allEventsMap.has(ev.event_id)) {
            allEventsMap.get(ev.event_id).is_registered = true
          } else {
            allEventsMap.set(ev.event_id, ev)
          }
        })
        const allEvents = Array.from(allEventsMap.values())
        interest.value = allEvents
        return {
          success: true,
          events: allEvents,
          count: allEvents.length,
          currentPage: page,
          pageSum: totalPageNo,
        }
      } else {
        throw error
      }
    } catch (error) {
      console.error('error in interested event', error)
    } finally {
      loading.value = false
    }
  }
  async function deleteInterest(event) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('interested_events')
      .delete()
      .eq('user_id', user.id)
      .eq('event_id', event.id)

    const { data: regData, error: regError } = await supabase
      .from('registered_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event.id)
      .single()
    if (regData) {
      await supabase
        .from('registered_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', event.id)
    }

    if (error || regError) {
      toast.error(error?.message || regError?.message)
      return
    }

    interest.value = interest.value.filter((item) => item.event_id !== event.id)
    toast.success('Removed from interested')
  }

  return {
    active,
    loading,
    interest,
    fetchInterest,
    deleteInterest,
  }
}
