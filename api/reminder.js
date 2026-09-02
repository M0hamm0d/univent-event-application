/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import nodemailer from 'nodemailer'
import { requireAuth } from './auth.js'
import { sendPushToUser, isPushAlreadySent, recordPushSent } from './push-utils.js'
const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey)

/**
 * Normalize a stored time value to "HH:MM" 24-hour format for comparison.
 * Handles: "13:00", "1:00 PM", "01:00PM", "1:00:00", "", null/undefined.
 * Returns "" if the input cannot be parsed (so it never matches a real time).
 */
function normalizeTimeTo24h(input) {
  if (!input || typeof input !== 'string') return ''
  let s = input.trim()
  // Already 24h like "13:00" or "13:00:00"
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m24) {
    return `${m24[1].padStart(2, '0')}:${m24[2]}`
  }
  // 12h like "1:00 PM", "01:00PM", "1:00:00 PM"
  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (m12) {
    let h = parseInt(m12[1], 10)
    const ampm = m12[3].toUpperCase()
    if (ampm === 'PM' && h < 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${m12[2]}`
  }
  return ''
}

/** Build the "next hour" target as "HH:00" 24h for comparison. */
function nextHour24h(now = new Date()) {
  const next = new Date(now)
  next.setHours(now.getHours() + 1, 0, 0, 0)
  return `${String(next.getHours()).padStart(2, '0')}:00`
}

async function fetchInterestedEvents() {
  let now = new Date()
  let tomorrowEvent = []
  let oneHrBeforeEvent = []

  const targetTime24h = nextHour24h(now)

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const todayStr = now.toISOString().split('T')[0]
  console.log(`Checking for Today (${todayStr}) at ${targetTime24h} and Tomorrow (${tomorrowStr})`)
  try {
    let { data: interested_events, error } = await supabaseAdmin
      .from('interested_events')
      .select(
        `
      id,
      a_day_email,
      an_hr_email,
      user_id (
        id,
        user_name,
        user_email
      ),
      event_id!inner (
        id,
        event_title,
        date,
        time,
        location,
        category,
        price,
        description,
        image_url
      )
     `,
      )
      .in('event_id.date', [todayStr, tomorrowStr])

    if (error) {
      console.error('Error fetching interested events:', error)
      return []
    }
    tomorrowEvent = interested_events.filter((event) => {
      return event.event_id.date == tomorrowStr && !event.a_day_email
    })
    oneHrBeforeEvent = interested_events.filter((event) => {
      return (
        event.event_id.date == todayStr &&
        normalizeTimeTo24h(event.event_id.time) === targetTime24h &&
        !event.an_hr_email
      )
    })
    return { tomorrowEvent, oneHrBeforeEvent }
  } catch (err) {
    console.error('Error fetching interested events:', err)
    return { tomorrowEvent: [], oneHrBeforeEvent: [] }
  }
}

// Mirror of fetchInterestedEvents but for registered attendees (status='registered').
// Registered users get the same day-before / hour-before reminders so they don't
// miss events they actually have a spot for.
async function fetchRegisteredEvents() {
  let now = new Date()
  let tomorrowEvent = []
  let oneHrBeforeEvent = []

  const targetTime24h = nextHour24h(now)

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const todayStr = now.toISOString().split('T')[0]

  try {
    let { data: registered_events, error } = await supabaseAdmin
      .from('registered_events')
      .select(
        `
      id,
      a_day_email,
      an_hr_email,
      user_id (
        id,
        user_name,
        user_email
      ),
      event_id!inner (
        id,
        event_title,
        date,
        time,
        location,
        category,
        price,
        description,
        image_url
      )
     `,
      )
      .eq('status', 'registered')
      .in('event_id.date', [todayStr, tomorrowStr])

    if (error) {
      console.error('Error fetching registered events:', error)
      return { tomorrowEvent: [], oneHrBeforeEvent: [] }
    }
    tomorrowEvent = registered_events.filter((event) => {
      return event.event_id.date == tomorrowStr && !event.a_day_email
    })
    oneHrBeforeEvent = registered_events.filter((event) => {
      return (
        event.event_id.date == todayStr &&
        normalizeTimeTo24h(event.event_id.time) === targetTime24h &&
        !event.an_hr_email
      )
    })
    return { tomorrowEvent, oneHrBeforeEvent }
  } catch (err) {
    console.error('Error fetching registered events:', err)
    return { tomorrowEvent: [], oneHrBeforeEvent: [] }
  }
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})
async function setReminder() {
  let events = await fetchInterestedEvents()
  try {
    for (let event of events.tomorrowEvent) {
      if (!event.a_day_email) {
        // await transporter.sendMail({
        //   from: process.env.EMAIL_USER,
        //   to: event.user_id.user_email,
        //   subject: `Reminder: ${event.event_id.event_title} is happening tomorrow!`,
        //   html: `Hi ${event.user_id.user_name}, \n\nThis is a reminder that the event "${event.event_id.event_title}" you are interested in is happening tomorrow (${event.event_id.date} at ${event.event_id.time}). Don't miss it!. \n\nEvent Details:\n- Date: ${event.event_id.date}\n- Time: ${event.event_id.time}\n- Location: ${event.event_id.location}\n\nBest regards,\nUniVent Team`,
        // })
        await transporter.sendMail({
          from: `"UniVent Team" <${process.env.EMAIL_USER}>`,
          to: event.user_id.user_email,
          subject: `📅 Reminder: ${event.event_id.event_title} is tomorrow!`,
          html: `
        <div style="font-family: sans-serif; background-color: #f3f4f6; padding: 40px 10px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">

            <!-- Header -->
            <div style="background-color: #1969fe; padding: 20px; text-align: center;">
              <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">See You Tomorrow</span>
            </div>

            <div style="padding: 30px;">
              <h2 style="color: #111827; margin-top: 0; font-size: 20px;">Hi ${event.user_id.user_name},</h2>
              <p style="color: #4b5563; line-height: 1.6;">This is a friendly reminder that an event you're interested in is happening <strong>tomorrow</strong>. We've saved you a spot!</p>

              <!-- Event Detail Card -->
              <div style="border-left: 4px solid #1969fe; background-color: #f9fafb; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 10px 0; color: #111827; font-size: 18px;">${event.event_id.event_title}</h3>
                <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">📅 <strong>Date:</strong> ${event.event_id.date}</p>
                <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">⏰ <strong>Time:</strong> ${event.event_id.time}</p>
                <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">📍 <strong>Location:</strong> ${event.event_id.location}</p>
              </div>

              <!-- Button -->
              <div style="text-align: center; margin-top: 30px;">
                <a href="https://univent.website/discover?modal=open&id=${event.event_id.id}"
                   style="background-color: #111827; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                   View Event Details
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sent via UniVent</p>
            </div>
          </div>
        </div>
      `,
        })
        await supabaseAdmin
          .from('interested_events')
          .update({ a_day_email: true })
          .eq('id', event.id)
        console.log(
          `Reminder sent to ${event.user_id.user_email} for event ${event.event_id.event_title} happening tomorrow.`,
        )
        // --- Push notification for interested: 1 day reminder ---
        try {
          const userId = event.user_id.id
          const eventId = event.event_id.id
          const reminderWindow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
          if (!(await isPushAlreadySent('reminder_1day', userId, eventId, reminderWindow))) {
            await sendPushToUser(userId, {
              title: `📅 ${event.event_id.event_title} is tomorrow!`,
              body: `Don't miss it — ${event.event_id.event_title} on ${event.event_id.date} at ${event.event_id.time}.`,
              url: `/discover?modal=open&id=${eventId}`,
              tag: `reminder-1day-${eventId}-${reminderWindow}`,
            })
            await recordPushSent('reminder_1day', userId, eventId, reminderWindow)
          }
        } catch (pushErr) {
          console.error('Push failed for interested 1day reminder:', pushErr.message)
        }
      }
    }
    for (let event of events.oneHrBeforeEvent) {
      if (!event.an_hr_email) {
        // await transporter.sendMail({
        //   from: process.env.EMAIL_USER,
        //   to: event.user_id.user_email,
        //   subject: `Reminder: ${event.event_id.event_title} is happening in an hour!`,
        //   html: `Hi ${event.user_id.user_name}, \n\nThis is a reminder that the event "${event.event_id.event_title}" you are interested in is happening in an hour (${event.event_id.date} at ${event.event_id.time}). Don't miss it!. \n\nEvent Details:\n- Date: ${event.event_id.date}\n- Time: ${event.event_id.time}\n- Location: ${event.event_id.location}\n\nBest regards,\nUniVent Team`,
        // })
        await transporter.sendMail({
          from: `"UniVent Team" <${process.env.EMAIL_USER}>`,
          to: event.user_id.user_email,
          subject: `⏰ Reminder: ${event.event_id.event_title} starts in 1 hour!`,
          html: `
    <div style="font-family: sans-serif; background-color: #f9fafb; padding: 40px 10px;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">

        <!-- Header Banner -->
        <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
          <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Event Reminder</span>
        </div>

        <div style="padding: 30px;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px;">Hey ${event.user_id.user_name}!</h2>
          <p style="color: #4b5563; line-height: 1.6;">Don't forget! The event you're interested in is happening in just <strong>one hour</strong>. Here are the details you need:</p>

          <!-- Event Detail Card -->
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 10px 0; color: #4f46e5; font-size: 18px;">${event.event_id.event_title}</h3>
            <p style="margin: 5px 0; color: #374151; font-size: 14px;">📅 <strong>Date:</strong> ${event.event_id.date}</p>
            <p style="margin: 5px 0; color: #374151; font-size: 14px;">⏰ <strong>Time:</strong> ${event.event_id.time}</p>
            <p style="margin: 5px 0; color: #374151; font-size: 14px;">📍 <strong>Location:</strong> ${event.event_id.location}</p>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://univent.website/discover?modal=open&id=${event.event_id.id}"
               style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
               View Event Details
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sent by the UniVent Team</p>
          <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 12px;">University of Ilorin</p>
        </div>
      </div>
    </div>
  `,
        })
        await supabaseAdmin
          .from('interested_events')
          .update({ an_hr_email: true })
          .eq('id', event.id)
        console.log(
          `Reminder sent to ${event.user_id.user_email} for event ${event.event_id.event_title} happening in an hour.`,
        )
        // --- Push notification for interested: 1 hour reminder ---
        try {
          const userId = event.user_id.id
          const eventId = event.event_id.id
          const reminderWindow = new Date().toISOString().split('T')[0]
          if (!(await isPushAlreadySent('reminder_1hr', userId, eventId, reminderWindow))) {
            await sendPushToUser(userId, {
              title: `⏰ ${event.event_id.event_title} starts in 1 hour!`,
              body: `Happening at ${event.event_id.time} — ${event.event_id.location || 'check event details'}.`,
              url: `/discover?modal=open&id=${eventId}`,
              tag: `reminder-1hr-${eventId}-${reminderWindow}`,
            })
            await recordPushSent('reminder_1hr', userId, eventId, reminderWindow)
          }
        } catch (pushErr) {
          console.error('Push failed for interested 1hr reminder:', pushErr.message)
        }
      }
    }

    // --- RegisteredAttendees reminders (separate from interest) ---
    const regEvents = await fetchRegisteredEvents()
    for (let event of regEvents.tomorrowEvent) {
      if (!event.a_day_email) {
        await transporter.sendMail({
          from: `"UniVent Team" <${process.env.EMAIL_USER}>`,
          to: event.user_id.user_email,
          subject: `📅 Reminder: ${event.event_id.event_title} is tomorrow!`,
          html: `
        <div style="font-family: sans-serif; background-color: #f3f4f6; padding: 40px 10px;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
            <div style="background-color: #1969fe; padding: 20px; text-align: center;">
              <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">See You Tomorrow</span>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #111827; margin-top: 0; font-size: 20px;">Hi ${event.user_id.user_name},</h2>
              <p style="color: #4b5563; line-height: 1.6;">This is a friendly reminder that an event you're <strong>registered</strong> for is happening <strong>tomorrow</strong>. Your spot is reserved!</p>
              <div style="border-left: 4px solid #1969fe; background-color: #f9fafb; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 10px 0; color: #111827; font-size: 18px;">${event.event_id.event_title}</h3>
                <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">📅 <strong>Date:</strong> ${event.event_id.date}</p>
                <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">⏰ <strong>Time:</strong> ${event.event_id.time}</p>
                <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">📍 <strong>Location:</strong> ${event.event_id.location}</p>
              </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sent via UniVent</p>
            </div>
          </div>
        </div>
      `,
        })
        await supabaseAdmin.from('registered_events').update({ a_day_email: true }).eq('id', event.id)
        console.log(
          `Registered reminder sent to ${event.user_id.user_email} for ${event.event_id.event_title} tomorrow.`,
        )
        // --- Push notification for registered: 1 day reminder ---
        try {
          const userId = event.user_id.id
          const eventId = event.event_id.id
          const reminderWindow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
          if (!(await isPushAlreadySent('reminder_1day', userId, eventId, reminderWindow))) {
            await sendPushToUser(userId, {
              title: `📅 ${event.event_id.event_title} is tomorrow!`,
              body: `Your registered spot is reserved — ${event.event_id.date} at ${event.event_id.time}.`,
              url: `/discover?modal=open&id=${eventId}`,
              tag: `reminder-1day-${eventId}-${reminderWindow}`,
            })
            await recordPushSent('reminder_1day', userId, eventId, reminderWindow)
          }
        } catch (pushErr) {
          console.error('Push failed for registered 1day reminder:', pushErr.message)
        }
      }
    }
    for (let event of regEvents.oneHrBeforeEvent) {
      if (!event.an_hr_email) {
        await transporter.sendMail({
          from: `"UniVent Team" <${process.env.EMAIL_USER}>`,
          to: event.user_id.user_email,
          subject: `⏰ Reminder: ${event.event_id.event_title} starts in 1 hour!`,
          html: `
    <div style="font-family: sans-serif; background-color: #f9fafb; padding: 40px 10px;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
          <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Event Reminder</span>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px;">Hey ${event.user_id.user_name}!</h2>
          <p style="color: #4b5563; line-height: 1.6;">Don't forget! The event you're <strong>registered</strong> for is happening in just <strong>one hour</strong>. Your spot is reserved!</p>
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 10px 0; color: #4f46e5; font-size: 18px;">${event.event_id.event_title}</h3>
            <p style="margin: 5px 0; color: #374151; font-size: 14px;">📅 <strong>Date:</strong> ${event.event_id.date}</p>
            <p style="margin: 5px 0; color: #374151; font-size: 14px;">⏰ <strong>Time:</strong> ${event.event_id.time}</p>
            <p style="margin: 5px 0; color: #374151; font-size: 14px;">📍 <strong>Location:</strong> ${event.event_id.location}</p>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">Sent by the UniVent Team</p>
          <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 12px;">University of Ilorin</p>
        </div>
      </div>
    </div>
  `,
        })
        await supabaseAdmin.from('registered_events').update({ an_hr_email: true }).eq('id', event.id)
        console.log(
          `Registered reminder sent to ${event.user_id.user_email} for ${event.event_id.event_title} in an hour.`,
        )
        // --- Push notification for registered: 1 hour reminder ---
        try {
          const userId = event.user_id.id
          const eventId = event.event_id.id
          const reminderWindow = new Date().toISOString().split('T')[0]
          if (!(await isPushAlreadySent('reminder_1hr', userId, eventId, reminderWindow))) {
            await sendPushToUser(userId, {
              title: `⏰ ${event.event_id.event_title} starts in 1 hour!`,
              body: `Your registered spot is reserved — happening at ${event.event_id.time}.`,
              url: `/discover?modal=open&id=${eventId}`,
              tag: `reminder-1hr-${eventId}-${reminderWindow}`,
            })
            await recordPushSent('reminder_1hr', userId, eventId, reminderWindow)
          }
        } catch (pushErr) {
          console.error('Push failed for registered 1hr reminder:', pushErr.message)
        }
      }
    }
  } catch (err) {
    console.error('Error sending reminder emails:', err)
  }
}
// await setReminder()
export default async function handler(req, res) {
  // Secret-only: this is a cron-triggered endpoint.
  const auth = await requireAuth(req, res, { allowSecretOnly: true })
  if (!auth.ok) {
    return res.status(401).json({ message: 'Unauthorized: missing or invalid API secret' })
  }
  try {
    await setReminder()
    return res.status(200).json({
      success: true,
      message: 'Reminder email sent successfully',
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    })
  }
}
