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

    // for (const user of users) {
    //   let categories = []
    //   try {
    //     categories =
    //       typeof user.interested_events === 'string'
    //         ? JSON.parse(user.interested_events)
    //         : user.interested_events || []
    //   } catch {
    //     categories = []
    //   }

    //   // Get events from last 7 days in user's preferred categories
    //   const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    //   const { data: events, error: eventsError } = await supabaseAdmin
    //     .from('events')
    //     .select('event_title, description, date, location, id')
    //     .in('category', categories)
    //     .gt('created_at', sevenDaysAgo)

    //   if (eventsError) throw eventsError

    //   if (events.length > 0) {
    //     const maxDescLength = 100
    //     const eventsList = events
    //       .slice(0, 5) // Limit to 5 events in the email
    //       .map((e) => {
    //         let desc = e.description || ''
    //         let truncated = false
    //         if (desc.length > maxDescLength) {
    //           desc = desc.slice(0, maxDescLength) + '...'
    //           truncated = true
    //         }
    //         return `
    //           <div style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;background: #fafbfc;box-shadow:0 2px 8px #0001;">
    //             <h3 style="margin:0 0 8px 0;">${e.event_title}</h3>
    //             <p style="margin:0 0 8px 0;color:#555;font-size:14px;">
    //               ${desc}${truncated ? ` <a style="color:#007bff;" href="https://univent.website/discover?page=1&modal=open&id=${e.id}" target="_blank">(See more)</a>` : ''}
    //             </p>
    //             <div style="font-size:13px;color:#888;">
    //               <span>📅 ${e.date}</span> &nbsp;|&nbsp; <span>📍 ${e.location}</span>
    //             </div>
    //           </div>
    //         `
    //       })
    //       .join('')

    //     // Create HTML content for the email and display the list of events with better formatting
    //     const htmlContent = `
    //       <h2>Hey! 🎉</h2>
    //       <p>We found ${events.length} new event(s) that match your interests!</p>
    //       <div>${eventsList}</div>
    //       <p>Check them out and don't miss the fun!</p>
    //     `

    //     await transporter.sendMail({
    //       from: process.env.EMAIL_USER,
    //       to: user.email,
    //       subject: `New Events You'll Love! 🎊`,
    //       html: htmlContent,
    //     })

    //     console.log(`Email sent to ${user.email}`)
    //   }
    // }
    await Promise.all(
      users.map(async (user) => {
        let categories = []
        try {
          categories =
            typeof user.interested_events === 'string'
              ? JSON.parse(user.interested_events)
              : user.interested_events || []
        } catch {
          categories = []
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        const { data: events, error: eventsError } = await supabaseAdmin
          .from('events')
          .select('event_title, description, date, location, id')
          .in('category', categories)
          .gt('created_at', sevenDaysAgo)

        if (eventsError) throw eventsError

        if (events.length > 0) {
          const maxDescLength = 100

          const eventsList = events
            .slice(0, 5)
            .map((e) => {
              let desc = e.description || ''
              let truncated = false

              if (desc.length > maxDescLength) {
                desc = desc.slice(0, maxDescLength) + '...'
                truncated = true
              }

              return `
            <div>
              <h3>${e.event_title}</h3>
              <p>
                ${desc}
                ${truncated ? `<a href="https://univent.website/discover?id=${e.id}">(See more)</a>` : ''}
              </p>
              <small>${e.date} | ${e.location}</small>
            </div>
          `
            })
            .join('')

          const htmlContent = `
        <h2>Hey! 🎉</h2>
        <p>We found ${events.length} new event(s) for you!</p>
        ${eventsList}
      `

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: `New Events You'll Love! 🎊`,
            html: htmlContent,
          })

          console.log(`Email sent to ${user.email}`)
        }
      }),
    )
    return res.status(200).json({ message: 'Update check completed.' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Error sending event updates.' })
  }
}
