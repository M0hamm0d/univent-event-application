import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import nodemailer from 'nodemailer'
// import cron from 'node-cron'
const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey)

async function fetchInterestedEvents() {
  let now = new Date()
  let tomorrowEvent = []
  let oneHrBeforeEvent = []

  let oneHrBefore = new Date(now)
  oneHrBefore.setHours(now.getHours() + 1)

  let hours = oneHrBefore.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  // let minutes = oneHrBefore.getMinutes()
  const timeStr = `${hours.toString().padStart(2, '0')}:00${ampm}`

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const todayStr = now.toISOString().split('T')[0]
  console.log(`Checking for Today (${todayStr}) at ${timeStr} and Tomorrow (${tomorrowStr})`)
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
      return event.event_id.date == todayStr && event.event_id.time == timeStr && !event.an_hr_email
    })
    return { tomorrowEvent, oneHrBeforeEvent }
  } catch (err) {
    console.error('Error fetching interested events:', err)
    return { tomorrowEvent: [], oneHrBeforeEvent: [] }
  }
}

let events = await fetchInterestedEvents()

console.log('----- TOMORROW EVENTS ---------')
console.table(
  events.tomorrowEvent.map((e) => ({
    user: e.user_id.user_email,
    title: e.event_id.event_title,
    date: e.event_id.date,
    time: e.event_id.time,
    aDayBeforeEmailSent: e.a_day_email,
  })),
)
console.log('----- EVENTS HAPPENING IN AN HOUR ---------')
console.table(
  events.oneHrBeforeEvent.map((e) => ({
    user: e.user_id.user_email,
    title: e.event_id.event_title,
    date: e.event_id.date,
    time: e.event_id.time,
    anHrBeforeEmailSent: e.an_hr_email,
  })),
)

console.log('Attempting login for:', process.env.EMAIL_USER)
console.log('Password length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0)

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
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: event.user_id.user_email,
          subject: `Reminder: ${event.event_id.event_title} is happening tomorrow!`,
          html: `Hi ${event.user_id.user_name}, \n\nThis is a reminder that the event "${event.event_id.event_title}" you are interested in is happening tomorrow (${event.event_id.date} at ${event.event_id.time}). Don't miss it!. \n\nEvent Details:\n- Date: ${event.event_id.date}\n- Time: ${event.event_id.time}\n- Location: ${event.event_id.location}\n\nBest regards,\nUniVent Team`,
        })
        await supabaseAdmin
          .from('interested_events')
          .update({ a_day_email: true })
          .eq('id', event.id)
        console.log(
          `Reminder sent to ${event.user_id.user_email} for event ${event.event_id.event_title} happening tomorrow.`,
        )
      }
    }
    for (let event of events.oneHrBeforeEvent) {
      if (!event.an_hr_email) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: event.user_id.user_email,
          subject: `Reminder: ${event.event_id.event_title} is happening in an hour!`,
          html: `Hi ${event.user_id.user_name}, \n\nThis is a reminder that the event "${event.event_id.event_title}" you are interested in is happening in an hour (${event.event_id.date} at ${event.event_id.time}). Don't miss it!. \n\nEvent Details:\n- Date: ${event.event_id.date}\n- Time: ${event.event_id.time}\n- Location: ${event.event_id.location}\n\nBest regards,\nUniVent Team`,
        })
        await supabaseAdmin
          .from('interested_events')
          .update({ an_hr_email: true })
          .eq('id', event.id)
        console.log(
          `Reminder sent to ${event.user_id.user_email} for event ${event.event_id.event_title} happening in an hour.`,
        )
      }
    }
  } catch (err) {
    console.error('Error sending reminder emails:', err)
  }
}
// await setReminder()
export default async function handler(req, res) {
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
// cron.schedule('0 * * * *', async () => {
//   console.log('Cron Job Triggered: Checking for events...')
//   await setReminder()
// })
