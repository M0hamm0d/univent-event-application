/* eslint-disable no-undef */
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
                <a href="https://univent-app.com/events/${event.event_id._id}"
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
            <a href="https://univent-app.com/events/${event.event_id._id}"
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
