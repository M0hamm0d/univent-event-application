import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import nodemailer from 'nodemailer'
import cron from 'node-cron'
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

function generateEmailTemplate({ name, title, date, time, location, type }) {
  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px; margin:auto; background:white; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.08);">

      <div style="background:#4f46e5; color:white; padding:20px; text-align:center;">
        <h2 style="margin:0;">🎉 UniVent Reminder</h2>
      </div>

      <div style="padding:25px;">
        <p style="font-size:16px;">Hi <strong>${name}</strong>,</p>

        <p style="font-size:15px; line-height:1.6;">
          This is a reminder that the event you are interested in is
          <strong>${type}</strong>.
        </p>

        <div style="background:#f9fafb; padding:15px; border-radius:8px; margin:20px 0;">
          <p><strong>📌 Event:</strong> ${title}</p>
          <p><strong>📅 Date:</strong> ${date}</p>
          <p><strong>⏰ Time:</strong> ${time}</p>
          <p><strong>📍 Location:</strong> ${location}</p>
        </div>

        <p style="font-size:15px;">
          Don't miss it! We hope to see you there.
        </p>

        <div style="text-align:center; margin:25px 0;">
          <a href="https://univent.vercel.app"
             style="background:#4f46e5; color:white; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold;">
             View Event
          </a>
        </div>

        <p style="font-size:13px; color:#666;">
          Best regards,<br/>
          <strong>UniVent Team</strong>
        </p>
      </div>

      <div style="background:#f1f1f1; padding:12px; text-align:center; font-size:12px; color:#777;">
        © ${new Date().getFullYear()} UniVent. All rights reserved.
      </div>

    </div>
  </div>
  `
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
          html: generateEmailTemplate({
            name: event.user_id.user_name,
            title: event.event_id.event_title,
            date: event.event_id.date,
            time: event.event_id.time,
            location: event.event_id.location,
            type: 'happening tomorrow',
          }),
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
          html: generateEmailTemplate({
            name: event.user_id.user_name,
            title: event.event_id.event_title,
            date: event.event_id.date,
            time: event.event_id.time,
            location: event.event_id.location,
            type: 'starting in 1 hour',
          }),
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
