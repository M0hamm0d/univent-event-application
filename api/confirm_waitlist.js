/* eslint-disable no-undef */
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { requireAuth } from './auth.js'
import { sendPushToUser } from './push-utils.js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }
  const auth = await requireAuth(req, res)
  if (!auth.ok) return
  const { email, name, event } = req.body
  if (!email || !event) {
    return res.status(400).json({ message: 'email and event are required' })
  }
  try {
    const result = await sendEmail({ to: email, name, event })

    // --- Push notification: added to waitlist ---
    try {
      const { data: profile } = await supabaseAdmin
        .from('profile')
        .select('id')
        .eq('user_email', email)
        .maybeSingle()
      if (profile?.id) {
        await sendPushToUser(profile.id, {
          title: `📋 You're on the waitlist for ${event.event_title}`,
          body: `The event is full, but you'll be automatically registered if a spot opens up.`,
          url: `/discover?modal=open&id=${event.id}`,
          tag: `waitlist-confirm-${event.id}`,
        })
      }
    } catch (pushErr) {
      console.error('Push failed for waitlist confirmation:', pushErr.message)
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('Error sending waitlist confirmation email:', err)
    return res.status(500).json({ message: 'Failed to send email' })
  }
}

async function sendEmail({ to, name, event }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  console.log(`📨 Sending email to ${to} for event "${event.event_title}"`)

  await transporter.sendMail({
    from: `"UniVent" <${process.env.EMAIL_USER}>`,
    to,
    subject: `You have been added to the waitlist for "${event.event_title}"`,
    text: `Dear ${name},

Thank you for your interest in ${event.event_title}. We wanted to let you know that the event is currently at full capacity, but you have been added to the waitlist.

If a spot becomes available, we will automatically register you for the event and notify you via email. In the meantime, we encourage you to keep an eye on your inbox for any updates regarding the event.

Event Details:
Event: ${event.event_title}
Date: ${event.date}
Time: ${event.time}
Location: ${event.location}

Best regards,
The UniVent Team`,
  })

  console.log('✅ Email sent')
}
