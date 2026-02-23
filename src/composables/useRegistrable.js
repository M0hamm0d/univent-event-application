import { supabase } from '@/supabase'

export const useRegistrable = () => {
	const isEventRegistrable = async (id) => {
		try {
			if (!id) return false

			const { data, error, status } = await supabase
				.from('events')
				.select('requires_registration')
				.eq('id', id)
				.single()

			if (error && status !== 406) throw error

			return !!(data && data.requires_registration)
		} catch (err) {
			console.error('isEventRegistrable error:', err.message || err)
			return false
		}
	}

	return { isEventRegistrable }
}

