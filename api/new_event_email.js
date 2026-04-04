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

    // Calculate 7 days ago in ISO format
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

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

          if (!categories.length) return

          const { data: events, error: eventsError } = await supabaseAdmin
            .from('events')
            .select('event_title, description, date, location, id, image_url')
            .in('category', categories)
            .gt('created_at', sevenDaysAgo) // ISO string used here

          if (eventsError) throw eventsError

          if (events && events.length > 0) {
            const eventsList = events.slice(0, 5).map(e => {
              return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">

    <!-- Event Image -->
    <tr>
      <td>
        <img
          src="${e.image || 'https://univent.website/default-event.jpg'}"
          alt="${e.event_title}"
          width="100%"
          style="display:block;border-top-left-radius:12px;border-top-right-radius:12px;"
        />
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding:16px;font-family:Arial, sans-serif;">

        <!-- Category + Price -->
        <table width="100%">
          <tr>
            <td style="font-size:12px;color:#ff4fa3;font-weight:bold;">
              ${e.category || 'Event'}
            </td>
            <td align="right" style="font-size:12px;font-weight:bold;">
              ${e.price || 'Free'}
            </td>
          </tr>
        </table>

        <!-- Title -->
        <h3 style="margin:10px 0 8px 0;font-size:18px;color:#111;">
          ${e.event_title}
        </h3>

        <!-- Date -->
        <p style="margin:4px 0;color:#666;font-size:14px;">
          ${e.date}
        </p>

        <!-- Location -->
        <p style="margin:4px 0 16px 0;color:#666;font-size:14px;">
          ${e.location}
        </p>

        <!-- Buttons -->
        <table width="100%">
          <tr>

            <!-- Interested Button -->
            <td>
              <a
                href="https://univent.website/discover?page=1&modal=open&id=${e.id}"
                style="
                  display:inline-block;
                  padding:10px 18px;
                  border:2px solid #2f6fed;
                  border-radius:20px;
                  color:#2f6fed;
                  text-decoration:none;
                  font-size:14px;
                  font-weight:bold;
                "
              >
                I am Interested
              </a>
            </td>

            <!-- View Details -->
            <td align="right">
              <a
                href="https://univent.website/discover?page=1&modal=open&id=${e.id}"
                style="
                  display:inline-block;
                  padding:10px 18px;
                  border:1px solid #ddd;
                  border-radius:20px;
                  color:#111;
                  text-decoration:none;
                  font-size:14px;
                  font-weight:bold;
                "
              >
                View Details
              </a>
            </td>

          </tr>
        </table>

      </td>
    </tr>

  </table>
  `;
            }).join('');

            // Create HTML content for the email and display the list of events with better formatting
            const htmlContent = `
  <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;">

    <h2 style="text-align:center;">🎉 New Events For You</h2>

    <p style="text-align:center;color:#666;">
      We found ${events.length} new events that match your interests.
    </p>

    ${eventsList}

    <div style="text-align:center;margin-top:20px;">
      <a href="https://univent.website/discover"
        style="
          background:#2f6fed;
          color:white;
          padding:12px 24px;
          text-decoration:none;
          border-radius:6px;
          font-weight:bold;
        ">
        Discover More Events
      </a>
    </div>

  </div>
`;

            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: user.email,
              subject: `New Events You'll Love! 🎊`,
              html: htmlContent,
            });
          }
        } catch (err) {
          console.error(`Failed to process user ${user.user_email}:`, err.message)
        }
      }),
    )

    return res.status(200).json({ message: 'Update check completed.' })
  } catch (error) {
    console.error('Global Error:', error)
    return res.status(500).json({ error: error.message || 'Error sending event updates.' })
  }
}
