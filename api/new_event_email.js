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
            result.push({ email: user.user_email, matchedEvents: 0, reason: 'no categories' })
            return
          }

          const { data: events, error: eventsError } = await supabaseAdmin
            .from('events')
            .select('event_title, description, date, location, id, image_url, category, price')
            .gt('created_at', sevenDaysAgo)

          if (eventsError) {
            console.error(`Error fetching events for ${user.user_email}:`, eventsError)
            result.push({ email: user.user_email, matchedEvents: 0, reason: 'fetch error' })
            return
          }

          const matchedEvents = events.filter((event) =>
            event.category.some((cat) =>
              categories.some(
                (userCat) =>
                  userCat.toLowerCase().includes(cat.toLowerCase()) ||
                  cat.toLowerCase().includes(userCat.toLowerCase()),
              ),
            ),
          )

          console.log(
            `User ${user.user_email}: found ${matchedEvents.length} matching events out of ${events.length} total`,
          )

          if (matchedEvents && matchedEvents.length > 0) {
            // Build HTML content safely
            const htmlContent = `<h1>New Events Just for You! 🎉</h1>
              <p>Hi there! Based on your interests, we found some new events you might love:</p>
              ${matchedEvents
                .map(
                  (event) => `
                    <div>
                      <h2>${event.event_title}</h2>
                      <p>${event.description || 'No description available'}</p>
                      <p><strong>Date:</strong> ${event.date}</p>
                      <p><strong>Location:</strong> ${event.location}</p>
                      <p><strong>Price:</strong> ${typeof event.price === 'number' ? '$' + event.price.toFixed(2) : event.price || 'Free'}</p>
                    </div>
                  `,
                )
                .join('')}
            `
            try {
              await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: user.user_email,
                subject: `New Events You'll Love! 🎊`,
                html: htmlContent,
              })
              totalEmailsSent++
              console.log(`Email sent to ${user.user_email}`)
              result.push({
                email: user.user_email,
                matchedEvents: matchedEvents.length,
                emailSent: true,
                userInterests: categories,
                matchedEventDetails: matchedEvents.map((e) => ({
                  event_title: e.event_title,
                  category: e.category,
                })),
              })
            } catch (emailError) {
              console.error(`Failed to send email to ${user.user_email}:`, emailError)
              result.push({
                email: user.user_email,
                matchedEvents: matchedEvents.length,
                emailSent: false,
                reason: 'email send failed',
                userInterests: categories,
                matchedEventDetails: matchedEvents.map((e) => ({
                  event_title: e.event_title,
                  category: e.category,
                })),
              })
            }
          } else {
            console.log(`No matching events for ${user.user_email}`)
            result.push({
              email: user.user_email,
              matchedEvents: 0,
              reason: 'no matches',
              userInterests: categories,
              totalEventsAvailable: events.length,
            })
          }
        } catch (err) {
          console.error(`Failed to process user ${user.user_email}:`, err.message)
          result.push({ email: user.user_email, matchedEvents: 0, reason: err.message })
        }
      }),
    )

    console.log(`Total emails sent: ${totalEmailsSent}`)
    return res.status(200).json({
      message: 'Update check completed.',
      emailsSent: totalEmailsSent,
      userCount: users.length,
      data: result,
    })
  } catch (error) {
    console.error('Global Error:', error)
    return res.status(500).json({ error: error.message || 'Error sending event updates.' })
  }
}
