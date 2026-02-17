<script setup>
const fetchRequestedAndEvents = async (page = 1, filters = {}) => {
  const from = (page - 1) * perPage.value
  const to = from + perPage.value - 1

  try {
    const { data: requested_event, error: reqError } = await supabase
      .from('requested-event')
      .select('*')

    let query = supabase.from('events').select('*', { count: 'exact' }).gte('date', today)
    if (filters.category && filters.category.length) {
      query.overlaps('category', filters.category)
    }
    if (filters.location && filters.location.length) {
      query = query.or(filters.location.map((l) => `location.ilike.%${l}%`).join(','))
    }

    if (filters.price === 'below 2000') {
      query = query.lte('price', 2000)
    }

    if (filters.price === 'between 2000 and 5000') {
      query = query.gt('price', 2000).lt('price', 5000)
    }

    if (filters.price === 'above 5000') {
      query = query.gt('price', 5000)
    }

    if (filters.date) {
      if (filters.date === 'today') {
        const today = new Date().toISOString().split('T')[0]
        query = query.eq('date', today)
      } else if (filters.date === 'this week') {
        const today = new Date()
        const weekFirstDay = new Date(today.setDate(today.getDate() - today.getDay()))
        const weekLastDay = new Date(weekFirstDay)
        weekLastDay.setDate(weekFirstDay.getDate() + 6)
        const formattedLastWeekDay = weekLastDay.toISOString().split('T')[0]
        const formattedFirstWeekDay = weekFirstDay.toISOString().split('T')[0]
        query = query.gte('date', formattedFirstWeekDay).lte('date', formattedLastWeekDay)
      } else if (filters.date === 'this month') {
        const today = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString()
          .split('T')[0]
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0]
        query = query.gte('date', firstDayOfMonth).lte('date', lastDayOfMonth)
      } else {
        query = query.eq('date', filters.date)
      }
    }

    if (filters.searchInput) {
      query = query.ilike('event_title', `%${filters.searchInput}%`)
    }

    query.range(from, to)

    const { data: events, error: eventError, count } = await query
    console.log(events)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id
    univentStore.pageCount = Math.ceil(count / perPage.value)

    if (reqError || eventError || sessionError) {
      throw reqError || eventError || sessionError
    }

    if (!userId) {
      console.log('noSession')
      return {
        success: true,
        requested_event: requested_event || [],
        events: events || [],
        pagesNo: univentStore.pageCount,
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
    console.log('events from use request', matching, notMatching)

    return {
      success: true,
      requested_event: requested_event || [],
      events: orderedEvent,
      pagesNo: univentStore.pageCount,
      count: count,
    }
  } catch (err) {
    console.error('fetchRequestedAndEvents error:', err)
    return { success: false, error: err.message }
  }
}
</script>
