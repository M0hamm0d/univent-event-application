/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey);

async function moveNextStudentToRegistered(event) {
  const { data: waitingList, error: waitingListError } = await supabaseAdmin
    .from('waiting_list')
    .select('*')
    .eq('event_id', event.id)
    .order('created_at', { ascending: true })
    .limit(1)

  if (waitingListError) {
    throw new Error(`Failed to retrieve waiting list: ${waitingListError.message}`)
  }

  if (waitingList.length === 0) {
    return { success: false, message: 'No students on the waiting list for this event' }
  }

  if (event.interested_students >= event.capacity && event.capacity !== 0 && event.capacity !== null) {
    return { success: false, message: 'Event is still full, cannot move student from waiting list' }
  }

  const student = waitingList[0]

  // Move student from waiting list to registered events
  const { error: insertError } = await supabaseAdmin
    .from('registered_events')
    .insert([{ user_id: student.user_id, event_id: event.id }])

  if (insertError) {
    throw new Error(`Failed to register student: ${insertError.message}`)
  } else{
    // Increment interested_students count in events table and send registration email to the student
    const { error: updateError } = await supabaseAdmin
      .from('events')
      .update({ interested_students: event.interested_students + 1 })
      .eq('id', event.id)

    if (updateError) {
      throw new Error(`Failed to update event's interested students count: ${updateError.message}`)
    }

    // Fetch user email and name for sending registration email
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profile')
      .select('*')
      .eq('id', student.user_id)
      .maybeSingle()
    if (userError) {
      throw new Error(`Failed to fetch user details: ${userError.message}`)
    }

    // Send registration email to the student
    try {
      await fetch('/api/registration_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.user_email,
          name: userData.user_name,
          event: event,
        }),
      });
    } catch (err) {
      console.error('Error sending registration email:', err)
    }
  }

  // Remove student from waiting list
  const { error: deleteError } = await supabaseAdmin
    .from('waiting_list')
    .delete()
    .eq('id', student.id)

  if (deleteError) {
    throw new Error(`Failed to remove student from waiting list: ${deleteError.message}`)
  }

  return { success: true, message: 'Moved next student from waitlist to registered' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const { event } = req.body
  try {
    await moveNextStudentToRegistered(event)
    return res.status(200).json({
      success: true,
      message: 'Student moved from waiting list to registered',
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    })
  }
}
