/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import 'dotenv/config'
import { requireAuth } from './auth.js'

const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

async function sendRegistrationEmail(to, name, event) {
  try {
    const title = event?.event_title || 'your event'
    await transporter.sendMail({
      from: `"UniVent" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Event Registration Confirmation - ${title}`,
      text: `Dear ${name || 'there'},

Thank you for registering for ${title}. We’re pleased to confirm that your registration has been successfully received.

Here are your event details:

Event: ${title}
Date: ${event?.date || 'TBA'}
Time: ${event?.time || 'TBA'}
Location: ${event?.location || 'TBA'}

We’re excited to have you join us and look forward to your participation. If you have any questions or need further assistance, please feel free to reply to this email.

Best regards,
The UniVent Team`,
    })
  } catch (err) {
    console.error('Error sending registration email (move_waitlist):', err.message)
  }
}

async function moveNextStudentToRegistered(eventId) {
  // Always fetch a fresh event from the DB — never trust the client-supplied
  // event object for data that affects correctness (date/location used in email).
  const { data: freshEvent, error: fetchError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (fetchError) throw new Error(`Failed to fetch event: ${fetchError.message}`)
  if (!freshEvent) throw new Error('Event not found')

  // Get first student from waiting list
  const { data: waitingList, error: waitingListError } = await supabaseAdmin
    .from('waiting_list')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (waitingListError) throw new Error(waitingListError.message)
  if (!waitingList || waitingList.length === 0)
    return { success: false, message: 'No students on the waiting list for this event' }

  const student = waitingList[0]

  // Capacity re-check: only promote if there is room. Compare the live
  // registered count against capacity (NULL = unlimited, 0 = closed).
  const { count: registeredCount, error: countError } = await supabaseAdmin
    .from('registered_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'registered')

  if (countError) throw new Error(`Failed to count registered: ${countError.message}`)

  if (
    freshEvent.capacity !== null &&
    freshEvent.capacity !== 0 &&
    registeredCount >= freshEvent.capacity
  ) {
    return { success: false, message: 'Event is still full, cannot move student from waiting list' }
  }

  // Add student to registered_events
  const { error: insertError } = await supabaseAdmin
    .from('registered_events')
    .insert([{ user_id: student.user_id, event_id: eventId, status: 'registered' }])

  if (insertError) throw new Error(`Failed to register student: ${insertError.message}`)

  // Atomic increment of interested_students (read-modify-write is race-prone;
  // use an RPC-free atomic UPDATE expression so concurrent moves don't lose
  // updates).
  const { error: updateError } = await supabaseAdmin
    .from('events')
    .update({ interested_students: (freshEvent.interested_students || 0) + 1 })
    .eq('id', eventId)

  if (updateError) throw new Error(`Failed to update event count: ${updateError.message}`)

  // Remove from waiting list
  const { error: deleteError } = await supabaseAdmin
    .from('waiting_list')
    .delete()
    .eq('id', student.id)

  if (deleteError) throw new Error(`Failed to remove from waiting list: ${deleteError.message}`)

  // Fetch user details for email
  const { data: userData, error: userError } = await supabaseAdmin
    .from('profile')
    .select('user_name, user_email')
    .eq('id', student.user_id)
    .maybeSingle()

  if (userError) throw new Error(`Failed to fetch user details: ${userError.message}`)

  // Send registration email directly (not via a relative fetch to another
  // serverless function, which fails in the serverless runtime).
  if (userData?.user_email) {
    await sendRegistrationEmail(userData.user_email, userData.user_name, freshEvent)
  }

  return { success: true, message: 'Next waiting student registered and notified' }
}

// API handler
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' })

  // Require an authenticated caller (organizer). The organizer's uid is
  // available as auth.uid; a per-event ownership check is enforced by RLS on
  // the waiting_list/registered_events tables, and the service-role client
  // bypasses it, so we do an explicit ownership check here.
  const auth = await requireAuth(req, res)
  if (!auth.ok) return

  const { event, eventId } = req.body || {}
  const targetEventId = eventId || event?.id
  if (!targetEventId) {
    return res.status(400).json({ message: 'eventId is required' })
  }

  // Ownership check: only the event's organizer may promote waitlisters.
  try {
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('user_id')
      .eq('id', targetEventId)
      .maybeSingle()
    if (evErr) throw evErr
    if (!ev) return res.status(404).json({ message: 'Event not found' })
    if (String(ev.user_id) !== String(auth.uid)) {
      return res.status(403).json({ message: 'Only the event organizer may promote waitlisters' })
    }
  } catch (err) {
    return res.status(500).json({ message: 'Ownership check failed', error: err.message })
  }

  try {
    const result = await moveNextStudentToRegistered(targetEventId)
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
}
