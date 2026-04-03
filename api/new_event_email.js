/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
const baseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SERVICE_ROLE_KEY
const supabaseAdmin = createClient(baseUrl, serviceRoleKey)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  try {
    // Get all users with their preferred categories
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profile')
      .select('id, email, interested_events')

    if (usersError) throw usersError

    await Promise.all(
      users.map(async (user) => {
        try {
          let categories = []

          try {
            categories =
              typeof user.interested_events === 'string'
                ? JSON.parse(user.interested_events)
                : user.interested_events || []
          } catch {
            categories = []
          }

          if (!categories.length) return

          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

          const { data: events, error: eventsError } = await supabaseAdmin
            .from('events')
            .select('event_title, description, date, location, id')
            .in('category', categories)
            .gt('created_at', sevenDaysAgo)

          if (eventsError) throw eventsError

          if (events.length > 0) {
            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: user.email,
              subject: `New Events You'll Love! 🎊`,
              html: `<p>${events.length} new events</p>`,
            })
          }
        } catch (err) {
          console.error(`User failed: ${user.email}`, err)
        }
      }),
    )
    return res.status(200).json({ message: 'Update check completed.' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Error sending event updates.' })
  }
}
