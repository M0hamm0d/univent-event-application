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
    pass: process.env.EMAIL_PASSWORD, // Must be an App Password
  },
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profile')
      .select('id, user_email, interested_events')

    if (usersError) throw usersError

    console.log(`Found ${users.length} users`)

    // Calculate 7 days ago in ISO format
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    console.log(`Checking for events created after: ${sevenDaysAgo}`)

    let totalEmailsSent = 0
    const result = []

    await Promise.all(
      users.map(async (user) => {
        try {
          let categories = []

          // Parsing logic
          if (typeof user.interested_events === 'string') {
            try {
              categories = JSON.parse(user.interested_events)
            } catch {
              categories = [user.interested_events]
            }
          } else {
            categories = user.interested_events || []
          }

          console.log(`User ${user.user_email}: categories = ${JSON.stringify(categories)}`)

          if (!categories.length) {
            console.log(`User ${user.user_email}: no categories, skipping`)
            return
          }

          const { data: events, error: eventsError } = await supabaseAdmin
            .from('events')
            .select('event_title, description, date, location, id, image_url, category, price')
            .overlaps('category', categories)
            .gt('created_at', sevenDaysAgo)

          if (eventsError) {
            console.error(`Error fetching events for ${user.user_email}:`, eventsError)
            throw eventsError
          }

          console.log(`User ${user.user_email}: found ${events?.length || 0} matching events`)

          if (events && events.length > 0) {
            // ... existing email sending code ...
            const htmlContent = `<h1>New Events Just for You! 🎉</h1>
              <p>Hi there! Based on your interests, we found some new events you might love:</p>
              ${events
                .map(
                  (event) => `
                    <div>
                      <h2>${event.event_title}</h2>
                      <p>${event.description}</p>
                      <p><strong>Date:</strong> ${event.date}</p>
                      <p><strong>Location:</strong> ${event.location}</p>
                      <p><strong>Price:</strong> $${event.price.toFixed(2)}</p>
                    </div>
                  `,
                )
                .join('')}
            `
            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: user.user_email,
              subject: `New Events You'll Love! 🎊`,
              html: htmlContent,
            })
            totalEmailsSent++
            console.log(`Email sent to ${user.user_email}`)
          } else {
            console.log(`No events for ${user.user_email}`)
          }
        } catch (err) {
          console.error(`Failed to process user ${user.user_email}:`, err.message)
        }
        return res.status(200).json({
          message: 'Update check completed.',
          emailsSent: totalEmailsSent,
          usersCount: users.length,
          data: result,
        })
      }),
    )

    console.log(`Total emails sent: ${totalEmailsSent}`)
    return res.status(200).json({
      message: 'Update check completed.',
      emailsSent: totalEmailsSent,
      user: users.user_email,
      useCategories: users.interested_events,
      eventCategories: events.categories,
    })
  } catch (error) {
    console.error('Global Error:', error)
    return res.status(500).json({ error: error.message || 'Error sending event updates.' })
  }
}
